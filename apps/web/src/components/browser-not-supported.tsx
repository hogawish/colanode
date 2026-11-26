import { MonitorOff } from 'lucide-react';

export const BrowserNotSupported = () => {
  return (
    <div className="min-w-screen flex h-full min-h-screen w-full items-center justify-center">
      <div className="flex flex-col items-center gap-8 text-center w-lg">
        <MonitorOff className="h-10 w-10 text-foreground" />
        <h2 className="text-4xl text-foreground">Browser not supported</h2>
        <p className="text-sm text-muted-foreground">
          Unfortunately, your browser does not support the Origin Private File
          System (OPFS) feature that Tsuzunowa requires to function properly.
        </p>
        <p className="text-sm text-muted-foreground">
          If you're self-hosting Tsuzunowa make sure you are accessing the web
          version through a secure 'https' way, because some browsers require
          HTTPS to use the features required.
        </p>
        <p className="text-sm text-muted-foreground mt-4">
          Try another browser, or check the{' '}
          <a
            href="https://github.com/hogawish/tsuzunowa#try-the-source-preview"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary"
          >
            setup guide
          </a>{' '}
          for installation options. If you think this is a mistake or you have
          any questions, please open an issue on{' '}
          <a
            href="https://github.com/hogawish/tsuzunowa/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary"
          >
            Github
          </a>
        </p>
      </div>
    </div>
  );
};
