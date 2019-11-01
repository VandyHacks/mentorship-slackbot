import {
  Session,
  ClaimedSession,
  UserID,
  TS,
  Mentor,
  isActive,
  isClaimed,
  ActiveSession
} from "typings";

import DB from 'mongo';

// if (await this.getSlackSessions().value() == null) {
//   db.set("sessions", {}).write();
// }

class Store {
  online: number
  created: number
  db: DB
  public constructor() {
    // just stored in memory
    this.created = 0
    this.online = 0
    this.db = new DB();
  }
  // connects once
  public async getSlackSessions() {
    return (await this.db.collections).SlackSessions
  }

  public async getSlackMentors() {
    return (await this.db.collections).SlackMentors
  }

  public async getSession(user: UserID): Promise<Session> {
    const sessions = await this.getSlackSessions()
    // @ts-ignore
    return sessions.find({ id: user }).toArray()
  }

  public async getSessionsToBump(): Promise<ActiveSession[]> {
    let sessions = await this.getSlackSessions()
    // @ts-ignore
    let all = await sessions.find({}).toArray()
    let filtered = all.filter(
      (session: Session) =>
        isActive(session) &&
        !isClaimed(session) &&
        new Date(session.last_updated).getTime() <
        new Date().getTime() - 1000 * 60 * 10
    ) as ActiveSession[]
    sessions.updateMany({ _id: { $in: filtered.map(e => e.id) } },
      {
        $set: {
          "last_updated": new Date().toString()
        }
      })
    return sessions.find({ _id: { $in: filtered.map(e => e.id) } }).toArray() as Promise<ActiveSession[]>;
  }

  public async updateSession<T extends Partial<Session>>(
    user: UserID,
    newSession: T
  ): Promise<Session & T> {
    const sessions = await this.getSlackSessions()
    const newData = {
      ...newSession,
      // eslint-disable-next-line @typescript-eslint/camelcase
      last_updated: new Date().toString()
    }
    // findOneAndUpdate returns back doc
    return sessions.findOneAndUpdate(
      { id: user },
      { $set: newData },
      { returnOriginal: false }) as Promise<Session & T>
  }

  public async clearSession(user: UserID): Promise<Session> {
    const sessions = await this.getSlackSessions()
    const reset = {
      ts: undefined,
      mentor: undefined,
      mentor_claim_ts: undefined,
      group_id: undefined
    }
    return sessions.findOneAndUpdate({ id: user }, { $set: reset }, { returnOriginal: true }) as Promise<Session>
  }

  public async getUserIdByThreadTs(threadTs: TS): Promise<UserID | undefined> {
    const sessions = await this.getSlackSessions()
    const users = await sessions.find({ ts: threadTs }).toArray()
    return users.length > 0 ? users[0].id : undefined
  }

  public getMentors = async () => {
    const mentors = await this.getSlackMentors()
    return mentors.find({}).toArray();
  }

  public setMentors = async (mentorsData: { [key: string]: Mentor }) => {
    // uhhhh
    const mentors = await this.getSlackMentors()
    mentors.deleteMany({})
    mentors.insertMany(Object.values(mentorsData));
  }
  public getMentor = async (user: UserID): Promise<Mentor | null> => {
    const mentors = await this.getSlackMentors()
    return mentors.findOne({ id: user });
  }

  public async setMentorSkills(
    user: UserID,
    skills: {
      [key: string]: boolean;
    }
  ) {
    const mentors = await this.getSlackMentors()
    return mentors.findOneAndUpdate({ _id: user }, { skills: skills })
  }

  public getOnline = () => this.online
  public setOnline = (count: number) => this.online = count
  public getCreated = () => this.created
  public bumpCreated = () => this.created += 1
}
const db = new Store()
export default db;