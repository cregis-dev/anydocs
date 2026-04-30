import type { Server } from 'node:http';

export type {
  ApiSourceDoc,
  BuildWorkflowResult,
  DeletePageResult,
  DocsLang,
  NavigationDoc,
  PageDoc,
  PreviewWorkflowResult,
  ProjectConfig,
  ProjectContract,
  ProjectPathContract,
  ProjectSiteTopNavItem,
} from '../../core/dist/index.js';

export type IpcErrorPayload = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type DesktopServerResponse<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: IpcErrorPayload;
    };

export type StudioProjectSettingsPatch = {
  name?: string;
  languages?: import('../../core/dist/index.js').DocsLang[];
  defaultLanguage?: import('../../core/dist/index.js').DocsLang;
  site?: {
    theme?: {
      id?: string;
      branding?: {
        siteTitle?: string;
        homeLabel?: string;
        logoSrc?: string;
        logoAlt?: string;
      };
      chrome?: {
        showSearch?: boolean;
      };
      colors?: {
        primary?: string;
        primaryForeground?: string;
        accent?: string;
        accentForeground?: string;
        sidebarActive?: string;
        sidebarActiveForeground?: string;
      };
      codeTheme?: 'github-light' | 'github-dark';
    };
    navigation?: {
      topNav?: import('../../core/dist/index.js').ProjectSiteTopNavItem[];
    };
  };
  build?: {
    outputDir?: string;
  };
};

export type StudioProjectScope = {
  projectId?: string;
  projectPath?: string;
};

export type StudioProjectCreateInput = {
  projectPath: string;
  projectId?: string;
  projectName?: string;
  defaultLanguage?: import('../../core/dist/index.js').DocsLang;
  languages?: import('../../core/dist/index.js').DocsLang[];
  agent?: 'codex' | 'claude-code';
};

export type StudioProjectCreateResponse = {
  project: import('../../core/dist/index.js').ProjectContract;
  createdFiles: string[];
};

export type StudioPageCreateInput = {
  slug: string;
  title: string;
};

export type DesktopServerOptions = {
  host?: string;
  port?: number;
  projectRoot?: string;
  logger?: Pick<Console, 'info' | 'error' | 'warn'>;
};

export type DesktopServerRuntime = {
  server: Server;
  host: string;
  port: number;
  url: string;
  close: () => Promise<void>;
};
