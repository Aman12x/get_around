export type TopicId = 'history' | 'technology' | 'art' | 'politics' | 'current-affairs' | 'general';

export interface Topic {
  id: TopicId;
  label: string;
  icon: string;
  color: string;
  blurb: string;
}

export const TOPICS: Topic[] = [
  { id: 'history', label: 'History', icon: '🏛️', color: '#ffb020', blurb: 'Empires, revolutions & turning points' },
  { id: 'technology', label: 'Technology', icon: '⚙️', color: '#22d3ee', blurb: 'Inventors, science & engineering' },
  { id: 'art', label: 'Art & Culture', icon: '🎨', color: '#f472b6', blurb: 'Painting, music, literature & film' },
  { id: 'politics', label: 'Politics', icon: '⚖️', color: '#a78bfa', blurb: 'Rulers, constitutions & institutions' },
  { id: 'current-affairs', label: 'Current Affairs', icon: '📰', color: '#a3e635', blurb: 'What happened in the 2020s' },
  { id: 'general', label: 'General Knowledge', icon: '🌍', color: '#fb923c', blurb: 'Geography, food, sport & more' },
];

export const TOPIC_BY_ID: Record<TopicId, Topic> = Object.fromEntries(
  TOPICS.map((t) => [t.id, t]),
) as Record<TopicId, Topic>;
