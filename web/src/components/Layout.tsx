import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import ShortcutsModal from "./ShortcutsModal";

export default function Layout() {
  return (
    <div className="min-h-[100dvh] bg-ink-950 text-ink-100 sm:flex sm:h-screen sm:min-h-0 sm:overflow-hidden">
      <Sidebar />
      <main className="app-main min-w-0 flex-1 overflow-x-auto overflow-y-auto">
        <div className="w-full min-w-0">
          <Outlet />
        </div>
      </main>
      <ShortcutsModal />
    </div>
  );
}
