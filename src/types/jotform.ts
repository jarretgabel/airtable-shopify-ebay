export interface JotFormAnswer {
  name: string;
  order: string;
  text: string;         // question label
  type: string;         // e.g. "control_textbox", "control_email", "control_phone", etc.
  answer?: string | string[] | Record<string, string>;
  prettyFormat?: string;
}

export interface JotFormSubmission {
  id: string;
  form_id: string;
  ip: string;
  created_at: string;   // "2024-03-11 14:22:05"
  status: 'ACTIVE' | 'DELETED';
  new: '0' | '1';
  flag: '0' | '1';
  notes: string;
  answers: Record<string, JotFormAnswer>;
}

export interface JotFormForm {
  id: string;
  username: string;
  title: string;
  height: string;
  status: 'ENABLED' | 'DISABLED' | 'DELETED';
  created_at: string;
  updated_at: string;
  last_submission: string | null;
  new: number;          // unread submission count
  count: number;        // total submission count
  type: 'LEGACY' | 'CARD';
  favorite: '0' | '1';
  archived: '0' | '1';
  url: string;
}

export interface JotFormApiResponse<T> {
  responseCode: number;
  message: string;
  content: T;
  resultSet?: {
    offset: number;
    limit: number;
    count: number;
  };
}
