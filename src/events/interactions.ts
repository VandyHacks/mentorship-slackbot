import SlackMessageAdapter from "@slack/interactive-messages/dist/adapter";

import * as Message from "actions/message";
import { webClient } from "clients";
import { handle, swallow } from "utils";

import db from "db";

import {
  UserID,
  ChannelID,
  Submission,
  TS,
  coerceActive,
  coerceClaimed,
  ClaimedSession,
  isActive,
  coerceEmpty,
  isClaimed
} from "typings";

const {
  bumpCreated,
  getSession,
  clearSession,
  getUserIdByThreadTs,
  updateSession
} = db;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Respond = (message: any) => Promise<unknown>;
interface ActionPayload {
  channel: {
    id: ChannelID;
  };
  trigger_id: string;
  user: {
    name: string;
    id: UserID;
  };
}
interface MessagePayload extends ActionPayload {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actions: any;
  message: {
    ts: string;
  };
}
interface DialogPayload extends ActionPayload {
  state: string;
  submission: Submission;
}

async function needMentor(payload: MessagePayload, respond: Respond) {
  // check for existing session
  const session = await getSession(payload.user.id);
  if (isActive(session)) {
    return Message.Mentee.alreadyActive(respond);
  } else {
    // send problem prompt text
    return Message.Mentee.openRequestDialog(
      payload.trigger_id,
      payload.message.ts
    );
  }
}

async function mentorRequest(payload: DialogPayload) {
  const { user, channel, submission, state } = payload;
  const session = await updateSession(user.id, {
    username: user.name,
    channel: channel.id,
    mentee_ts: state,
    submission
  });
  bumpCreated();
  return Message.Mentors.sendRequest(session).then(async ({ ts }) =>
    Message.Mentee.updateRequest(
      coerceActive(await updateSession(user.id, { ts: ts as TS }))
    )
  );
}

async function cancelRequest({ user: { id } }: MessagePayload) {
  const session = coerceActive(await getSession(id), true);
  return Promise.all([
    Message.Mentee.updateRequest(session, "canceled"),
    Message.Mentors.updateRequest(session, "canceled"),
    Message.Mentee.needMentor(coerceEmpty(await clearSession(id)))
  ]);
}

async function claimRequest(payload: MessagePayload) {
  const userId = await getUserIdByThreadTs(payload.message.ts);

  if (userId === undefined)
    throw new Error(`Undefined user_id for ts '${payload.message.ts}'`);

  const { mentor } = await updateSession(userId, {
    mentor: payload.user.id
  });

  return (
    webClient.conversations
      .open({
        users: [userId, mentor].join(",")
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(async ({ channel }: any) => {
        const session = await updateSession(userId, {
          group_id: channel.id
        }) as ClaimedSession;
        return Promise.all([
          // update the new channel
          Message.Session.introduce(session),
          // update the existing user message
          Message.Mentors.updateRequest(session),
          // let the mentor know
          Message.Mentors.claimControls(session)
        ]).then(async ([, , { ts, channel }]) =>
          coerceClaimed(
            await updateSession(userId, {
              mentor_claim_ts: ts as TS,
              mentor_channel: channel as ChannelID
            })
          )
        );
      })
  );
}

async function deleteRequest(payload: MessagePayload) {
  const userId = payload.actions[0].value;
  const session = coerceActive(await getSession(userId), true);
  return Promise.all([
    // Update mentors channel that it has been deleted
    Message.Mentors.updateRequest(session, "deleted"),
    // Update the mentor controls if it has been claimed
    isClaimed(session)
      ? Message.Mentors.deleteControls(session)
      : Promise.resolve(null),
    // Update the mentee session
    Message.Mentee.updateRequest(session, "deleted"),
    // Let the mentee know it's been deleted, then ask
    // if they need a new request
    Message.Mentee.deleted(session).then(() =>
      Message.Mentee.needMentor(session)
    ),
    // Clear the session
    Promise.resolve(clearSession(userId))
  ]);
}

async function surrenderRequest(payload: MessagePayload) {
  const userId = payload.actions[0].value;
  const session = coerceClaimed(await getSession(userId));
  const newSession = coerceActive(
    await updateSession(userId, {
      mentor_claim_ts: undefined,
      group_id: undefined,
      mentor: undefined
    })
  );
  return Promise.all([
    // Update mentor controls as "surrendered"
    Message.Mentors.surrenderControls(session),
    // Let the channel know the mentor has surrendered
    Message.Session.surrender(session),
    // Update the request in the mentors channel
    Message.Mentors.updateRequest(newSession),
    // Let the mentors channel know it's been surrendered
    Message.Mentors.surrenderBump(newSession)
  ]);
}

async function completeRequest(payload: MessagePayload) {
  const userId = payload.actions[0].value;
  const session = coerceClaimed(await getSession(userId));
  return Promise.all([
    // Update the controls for the mentor
    Message.Mentors.completeControls(session),
    // Let the mentee know their request has been completed
    Message.Mentee.updateRequest(session, "mentee_completed"),
    // Ask the mentee if they need a new request
    Message.Mentee.noSession(session),
    // Update the mentor channel to say it's complete
    Message.Session.complete(session)
  ]).then(async () => coerceEmpty(await clearSession(userId)));
}

export const bootstrap = (interactions: SlackMessageAdapter) => {
  interactions.action({ actionId: "need_mentor" }, handle(needMentor));
  interactions.action(
    { callbackId: "mentor_request" },
    swallow(handle(mentorRequest))
  );
  interactions.action({ actionId: "cancel_request" }, handle(cancelRequest));
  interactions.action({ actionId: "claim_request" }, handle(claimRequest));
  interactions.action({ actionId: "delete_request" }, handle(deleteRequest));
  interactions.action(
    { actionId: "surrender_request" },
    handle(surrenderRequest)
  );
  interactions.action(
    { actionId: "complete_request" },
    handle(completeRequest)
  );
};
