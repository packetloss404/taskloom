import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout() {
  return (
    <div className="min-h-[100dvh] bg-ink-950 text-ink-100 sm:flex sm:h-screen sm:min-h-0 sm:overflow-hidden">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-x-auto overflow-y-auto">
        <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
