export interface GoodsAndServices {
  search_class: { number: number };
  text: string;
}

export interface Trademark {
  id: string;
  registry_name: string;
  mark_text: string;
  application_number: string;
  registration_number?: string;
  status: 'Registered' | 'Pending' | 'Published' | 'Expired' | 'Abandoned';
  filing_date?: string;
  registration_date?: string;
  expiry_date?: string;
  publication_date?: string;
  client_agent_name?: string;
  good_and_services?: GoodsAndServices[];
  publication_notes?: string;
}

export interface TrademarkData {
  count: number;
  trademarks: Trademark[];
  fetchedAt: string;
  source?: string;
}

export interface Note {
  id: string;
  text: string;
  html?: string | null;
  link?: string | null;
  author: string;
  authorFull: string;
  date: string;
}

export interface Obligation {
  type: string;
  desc: string;
  dueDate: Date;
  windowStart: Date;
  daysUntil: number;
  critical: boolean;
  actionable: boolean;
  overdue: boolean;
  inWindow: boolean;
}
