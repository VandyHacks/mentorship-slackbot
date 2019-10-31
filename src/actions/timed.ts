import db from "db";
import { runnable, interval } from "date";
import { handle } from "utils";

import { rescan } from "./users";
import * as Message from "./message";
import { ActiveSession } from 'typings';

const bumpSessions = handle(async () => {
  const sessions = await db.getSessionsToBump() as ActiveSession[];
  return Promise.all(sessions.map(Message.Mentors.bump));
});

export const stats = handle(() => {
  if (!runnable()) return Promise.resolve(null);
  const created = db.getCreated();
  const online = db.getOnline();
  return Message.Stats.update(created, online);
});

export const init = () => {
  // bump dead requests every 30s
  interval(bumpSessions, 30000);
  bumpSessions();

  // rescan users list every 15min
  interval(rescan, 1000 * 60 * 15);
  rescan();

  // send stats every 3 hours
  interval(stats, 1000 * 60 * 60 * 3);
};

export { runnable };
