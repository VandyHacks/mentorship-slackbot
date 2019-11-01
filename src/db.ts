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


// connects once
const _db = new DB();
const getSlackSessions = async () => {
  return (await _db.collections).SlackSessions
}

const getSlackMentors = async () => {
  return (await _db.collections).SlackMentors
}

// INITIAL SETUP
(async () => {
  const sessions = await getSlackSessions()
  if (!sessions) {
    console.log('Initializing slack sessions...')
    // sessions.insertMany({});
  }
})();


class Store {
  online: number
  created: number
  constructor() {
    // just stored in memory
    this.created = 0
    this.online = 0
  }

  getSession = async (user: UserID): Promise<Session> => {
    const sessions = await getSlackSessions()
    const session = await sessions.findOne({ id: user })
    if (!session) {
      // throw Error(`Session not found for userID=${user}`)
      return {} as Session
    }
    return session
  }

  getSessionsToBump = async (): Promise<ActiveSession[]> => {
    let sessions = await getSlackSessions()
    let all = await sessions.find({}).toArray()
    let filtered = all.filter(
      (session: Session) =>
        isActive(session) &&
        !isClaimed(session) &&
        new Date(session.last_updated).getTime() <
        new Date().getTime() - 1000 * 60 * 10
    ) as ActiveSession[]
    await sessions.updateMany({ _id: { $in: filtered.map(e => e.id) } },
      {
        $set: {
          "last_updated": new Date().toString()
        }
      })
    return await sessions.find({ _id: { $in: filtered.map(e => e.id) } }).toArray() as ActiveSession[];
  }

  async updateSession<T extends Partial<Session>>(
    user: UserID,
    newSession: T
  ): Promise<Session & T> {
    const sessions = await getSlackSessions()
    const newData = {
      ...newSession,
      // eslint-disable-next-line @typescript-eslint/camelcase
      last_updated: new Date().toString()
    }
    // findOneAndUpdate returns back doc
    return await sessions.findOneAndUpdate(
      { id: user },
      { $set: newData },
      { returnOriginal: false, upsert: true }) as Promise<Session & T>
  }

  clearSession = async (user: UserID): Promise<Session> => {
    const sessions = await getSlackSessions()
    const reset = {
      ts: undefined,
      mentor: undefined,
      mentor_claim_ts: undefined,
      group_id: undefined
    }
    return await sessions.findOneAndUpdate({ id: user }, { $set: reset }, { returnOriginal: true }) as Promise<Session>
  }

  getUserIdByThreadTs = async (threadTs: TS): Promise<UserID | undefined> => {
    const sessions = await getSlackSessions()
    const users = await sessions.find({ ts: threadTs }).toArray()
    return users.length > 0 ? users[0].id : undefined
  }

  getMentors = async () => {
    const mentors = await getSlackMentors()
    return await mentors.find({}).toArray();
  }

  setMentors = async (mentorsData: { [key: string]: Mentor }) => {
    // uhhhh
    const mentors = await getSlackMentors()
    mentors.deleteMany({})
    mentors.insertMany(Object.values(mentorsData));
  }
  getMentor = async (user: UserID): Promise<Mentor | null> => {
    const mentors = await getSlackMentors()
    return await mentors.findOne({ id: user });
  }

  setMentorSkills = async (
    user: UserID,
    skills: {
      [key: string]: boolean;
    }
  ) => {
    const mentors = await getSlackMentors()
    return await mentors.findOneAndUpdate({ _id: user }, { skills: skills })
  }

  getOnline = () => this.online
  setOnline = (count: number) => this.online = count
  getCreated = () => this.created
  bumpCreated = () => this.created += 1
}
const db = new Store()
export default db;