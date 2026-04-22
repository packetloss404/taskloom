import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ActivityRecord } from "@/lib/types";
import ActivityRow from "@/components/ActivityRow";

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityRecord[] | null>(null);

  useEffect(() => {
    api.listActivity().then(setActivities).catch(() => setActivities([]));
  }, []);

  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-100">Activity</h1>
        <p className="mt-1 text-sm text-ink-400">Everything happening across the current workspace activation flow.</p>
      </header>

      <div className="card px-4">
        {activities === null ? (
          <div className="py-6 text-sm text-ink-400">Loading activity…</div>
        ) : activities.length === 0 ? (
          <div className="py-6 text-sm text-ink-400">No activity yet.</div>
        ) : (
          activities.map((activity) => <ActivityRow key={activity.id} activity={activity} />)
        )}
      </div>
    </>
  );
}
