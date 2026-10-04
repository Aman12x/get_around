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

const modules = import.meta.glob<QuestionBank>('./questions/*.json', { eager: true, import: 'default' });

const BANKS: Partial<Record<CountryId, QuestionBank>> = {};
for (const bank of Object.values(modules)) {
  BANKS[bank.country] = bank;
}

export function questionsFor(country: CountryId, topic: TopicId): Question[] {
  return BANKS[country]?.topics[topic] ?? [];
}

export function hasQuestions(country: CountryId, topic: TopicId): boolean {
  return questionsFor(country, topic).length > 0;
}
