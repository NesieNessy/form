/**
 * Storage tests for the coaching chat (roadmap Step 9): conversations are
 * the athlete's to read and delete but only the assistant function writes
 * them; memories are the athlete's alone; nothing leaks between accounts.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { openDatabase, readMigration, rejects, type Harness } from './harness';

const ATHLETE = 'a3000000-0000-4000-8000-0000000000a1';
const OTHER = 'a3000000-0000-4000-8000-0000000000a2';

let h: Harness;

describe('coaching chat migration', () => {
  let conversation: string;

  before(async () => {
    h = await openDatabase();
    await h.addUser(ATHLETE, 'athlete@example.com');
    await h.addUser(OTHER, 'other@example.com');
    // Written as the assistant function does, with the service role (here the superuser).
    conversation = (await h.db.query<{ id: string }>(`insert into chat_conversations (user_id, title) values ($1, 'What did I do last week?') returning id`, [ATHLETE])).rows[0].id;
    await h.db.query(
      `insert into chat_messages (conversation_id, user_id, role, content, payload) values ($1, $2, 'user', 'What did I do last week?', '{}'), ($1, $2, 'assistant', 'You did Fran.', '{"intent":"progress_summary"}')`,
      [conversation, ATHLETE]
    );
    await h.db.query(`insert into agent_runs (user_id, workflow, status) values ($1, 'chat', 'succeeded')`, [ATHLETE]);
  });

  it('can be run a second time without error', async () => {
    await h.db.exec(readMigration('migrations/0012_coach_chat.sql'));
  });

  it('lets the athlete read their conversation but not write into it', async () => {
    await h.as(ATHLETE, async () => {
      assert.equal(await h.count('chat_messages'), 2);
      await rejects(h.db.query(`insert into chat_messages (conversation_id, user_id, role, content) values ($1, $2, 'assistant', 'forged')`, [conversation, ATHLETE]), /permission denied/);
      await rejects(h.db.query(`update chat_messages set content = 'changed'`), /permission denied/);
    });
  });

  it('keeps conversations and memories between the athlete and the assistant only', async () => {
    await h.as(ATHLETE, () => h.db.query(`insert into coach_memories (user_id, text) values ($1, 'Prefers morning sessions')`, [ATHLETE]));
    await h.as(OTHER, async () => {
      for (const t of ['chat_conversations', 'chat_messages', 'coach_memories']) assert.equal(await h.count(t), 0, t);
      await rejects(h.db.query(`insert into coach_memories (user_id, text) values ($1, 'planted')`, [ATHLETE]), /row-level security/);
      await h.db.query(`delete from chat_conversations`);
    });
    assert.equal(await h.count('chat_conversations'), 1, 'another account cannot delete it');
    await rejects(h.as(ATHLETE, () => h.db.query(`insert into coach_memories (user_id, text) values ($1, '')`, [ATHLETE])), /check constraint/);
  });

  it('includes the conversations and memories in the export', async () => {
    const exported = await h.as(ATHLETE, () => h.call<{ assistant: { conversations: { messages: unknown[] }[]; memories: unknown[] } }>('export_my_data'));
    assert.deepEqual([exported.assistant.conversations.length, exported.assistant.conversations[0].messages.length, exported.assistant.memories.length], [1, 2, 1]);
  });

  it('deletes a conversation with its messages when the athlete deletes it', async () => {
    await h.as(ATHLETE, () => h.db.query(`delete from chat_conversations where id = $1`, [conversation]));
    assert.deepEqual([await h.count('chat_conversations'), await h.count('chat_messages')], [0, 0]);
  });
});
