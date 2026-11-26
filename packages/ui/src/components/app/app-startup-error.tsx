export const AppStartupError = () => (
  <main
    role="alert"
    className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"
  >
    <h1 className="text-xl font-semibold">Could not open Tsuzunowa</h1>
    <p>Reload this page to try again. Your saved data has not been cleared.</p>
    <button
      type="button"
      className="rounded-md border px-4 py-2"
      onClick={() => window.location.reload()}
    >
      Reload page
    </button>
  </main>
);
