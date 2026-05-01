export interface SourceEntry {
  label?: string;
  url?: string;
  quote?: string;
  page?: number | string;
  [key: string]: unknown;
}

export interface EditorialFlags {
  verified?: boolean;
  suspect?: boolean;
  source_confirmed?: boolean;
  note?: string;
  [key: string]: unknown;
}

export interface EntityRecord {
  head?: string;
  page_list?: number[];
  contexts?: Record<string, string[]>;
  editorial_flags?: EditorialFlags;
  sources?: SourceEntry[];
  subcategory?: string;
  epoch?: number | string;
  chapters?: Array<string | number>;
  [key: string]: unknown;
}

export interface ChapterRecord {
  name?: string;
  start?: number;
  end?: number;
  century?: number;
  [key: string]: unknown;
}

export interface GraphEdge {
  source?: string;
  target?: string;
  weight?: number;
  [key: string]: unknown;
}

export interface CorpusBook {
  book_id: string;
  title?: string;
  author?: string;
  year?: number;
  edition?: string;
  status?: string;
  source_type?: string;
  pages_total?: number;
  default_route?: string;
  content_modules?: string[];
  [key: string]: unknown;
}

export interface CorpusSourceType {
  type: string;
  title?: string;
  status?: string;
  planned_count?: number;
  supports?: string[];
  [key: string]: unknown;
}

export interface CorpusRegistry {
  schema_version?: number;
  active_book_id?: string;
  books?: CorpusBook[];
  source_types?: CorpusSourceType[];
  [key: string]: unknown;
}

export interface AppData {
  schema_version?: number;
  schema_migrations?: string[];
  corpus?: CorpusRegistry;
  labels?: Record<string, string>;
  colors?: Record<string, string>;
  epoch_labels?: Record<string, string>;
  epoch_colors?: Record<string, string>;
  family_colors?: Record<string, string>;
  names?: EntityRecord[];
  toponyms?: EntityRecord[];
  ethnonyms?: EntityRecord[];
  languages?: EntityRecord[];
  lexicon?: EntityRecord[];
  lexicon_reverse?: EntityRecord[];
  lexicon_tech?: EntityRecord[];
  subject_index?: EntityRecord[];
  glossary?: EntityRecord[];
  chapters?: ChapterRecord[];
  edges?: GraphEdge[];
  language_edges?: GraphEdge[];
  cross_links?: Record<string, unknown>;
  [key: string]: unknown;
}

declare global {
  interface Window {
    APP_DATA?: AppData;
    __vizCache?: Record<string, unknown>;
    VIZ_MODULES?: Record<string, unknown>;
  }
}

export {};
