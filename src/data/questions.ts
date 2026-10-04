import type { CountryId } from './countries';
import type { TopicId } from './topics';

export interface Question {
  q: string;
  choices: string[];
  answer: number;
  fact: string;
  difficulty: 1 | 2 | 3;
  asOf?: string;
}

export interface QuestionBank {
  country: CountryId;
  topics: Partial<Record<TopicId, Question[]>>;
}

// Each country's bank is its own small chunk, fetched when the traveler lands there.
const loaders = import.meta.glob<QuestionBank>('./questions/*.json', { import: 'default' });

const banks = new Map<CountryId, QuestionBank>();
const pending = new Map<CountryId, Promise<QuestionBank>>();

export function loadBank(country: CountryId): Promise<QuestionBank> {
  const cached = banks.get(country);
  if (cached) return Promise.resolve(cached);
  let p = pending.get(country);
  if (!p) {
    const loader = loaders[`./questions/${country}.json`];
    p = loader
      ? loader().then((bank) => {
          banks.set(country, bank);
          return bank;
        })
      : Promise.resolve({ country, topics: {} });
    // Forget failures so the next visit retries.
    p.catch(() => pending.delete(country));
    pending.set(country, p);
  }
  return p;
}

/** Questions for a loaded bank; call loadBank first. */
export function questionsFor(country: CountryId, topic: TopicId): Question[] {
  return banks.get(country)?.topics[topic] ?? [];
}
