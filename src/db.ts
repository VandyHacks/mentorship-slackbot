/* eslint-disable @typescript-eslint/ban-ts-ignore */
// import low from "lowdb";
import { ObjectID, DBRef } from 'mongodb';
// import FileSync from "lowdb/adapters/FileSync";
import {
  Session,
  UserID,
  TS,
  Mentor,
  isActive,
  isClaimed,
  ActiveSession
} from "typings";

import DB from 'mongo';

// if (await this.SlackSessions().value() == null) {
//   db.set("sessions", {}).write();
// }

export default class Store {
  online: number
  created: number
  public constructor() {
    // just stored in memory
    this.created = 0
    this.online = 0
  }
  // connects once
  SlackSessions = async () =>
    (await new DB().collections).SlackSessions

  SlackMentors = async () =>
    (await new DB().collections).SlackMentors

  public async getSession(user: UserID): Promise<Session> {
    const sessions = await this.SlackSessions()
    // @ts-ignore
    return sessions.find({ id: user }).toArray()
  }

  public async getSessionsToBump(): Promise<Session[]> {
    let sessions = await this.SlackSessions()
    // @ts-ignore
    let all = sessions.find({}).toArray()
      .filter(
        (session: Session) =>
          isActive(session) &&
          !isClaimed(session) &&
          new Date(session.last_updated).getTime() <
          new Date().getTime() - 1000 * 60 * 10
      )
      .toArray() as ActiveSession[];
    for (const session of filtered) {
      session.
        // @ts-ignore
        .get(session.id)
        .set("last_updated", new Date().toString())
        .write();
    }
    return sessions;
  }

  public async async updateSession<T extends Partial<Session>>(
    user: UserID,
    newSession: T
  ): Promise<Session & T> {
    const sessions = await this.SlackSessions()
    const newData = {
      ...newSession,
      // eslint-disable-next-line @typescript-eslint/camelcase
      last_updated: new Date().toString()
    }
    // findOneAndUpdate returns back doc
    return await sessions.findOneAndUpdate(
      { id: user },
      { $set: newData },
      { returnOriginal: false }) as Promise<Session & T>
  }

  public async clearSession(user: UserID): Promise<void> {
    const sessions = await this.SlackSessions()
    const reset = {
      ts: undefined,
      mentor: undefined,
      mentor_claim_ts: undefined,
      group_id: undefined
    }
    sessions.updateOne({ id: user }, { $set: reset })
  }

  public async getUserIdByThreadTs(threadTs: TS): Promise<UserID | undefined> {
    const sessions = await this.SlackSessions()
    const users = await sessions.find({ ts: threadTs }).toArray()
    return users.length > 0 ? users[0].id : undefined
  }

  public async getMentors = () => {
    const mentors = await this.SlackMentors()
    return mentors.find({}).toArray();
  }

  public async setMentors = (mentors: { [key: string]: Mentor }) =>
    // uhhhh
    db.set("mentors", mentors).write();

  public async getMentor = (user: UserID): Promise<Mentor | null> => {
    const mentors = await this.SlackMentors()
    return mentors.findOne({ id: user });
  }

  public async setMentorSkills(
    user: UserID,
    skills: {
      [key: string]: boolean;
    }
  ) {
    const mentors = await this.SlackMentors()
    return mentors
      // @ts-ignore
      .get(user)
      .set("skills", skills)
      .write();
  }

  public getOnline = () => this.online
  public setOnline = (count: number) => this.online = count
  public getCreated = () => this.created
  public bumpCreated = () => this.created += 1
}