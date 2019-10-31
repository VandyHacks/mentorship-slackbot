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

// if (await this.SlackSessions().value() == null) {
//   db.set("sessions", {}).write();
// }

class Store {
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

  public async getSessionsToBump(): Promise<ActiveSession[]> {
    let sessions = await this.SlackSessions()
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
    const sessions = await this.SlackSessions()
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
    const sessions = await this.SlackSessions()
    const reset = {
      ts: undefined,
      mentor: undefined,
      mentor_claim_ts: undefined,
      group_id: undefined
    }
    return sessions.findOneAndUpdate({ id: user }, { $set: reset }, { returnOriginal: true }) as Promise<Session>
  }

  public async getUserIdByThreadTs(threadTs: TS): Promise<UserID | undefined> {
    const sessions = await this.SlackSessions()
    const users = await sessions.find({ ts: threadTs }).toArray()
    return users.length > 0 ? users[0].id : undefined
  }

  public getMentors = async () => {
    const mentors = await this.SlackMentors()
    return mentors.find({}).toArray();
  }

  public setMentors = async (mentorsData: { [key: string]: Mentor }) => {
    // uhhhh
    const mentors = await this.SlackMentors()
    mentors.deleteMany({})
    mentors.insertMany(Object.values(mentorsData));
  }
  public getMentor = async (user: UserID): Promise<Mentor | null> => {
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
    return mentors.findOneAndUpdate({ _id: user }, { skills: skills })
  }

  public getOnline = () => this.online
  public setOnline = (count: number) => this.online = count
  public getCreated = () => this.created
  public bumpCreated = () => this.created += 1
}
const db = new Store()
export default db;