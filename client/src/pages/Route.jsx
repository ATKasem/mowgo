import { useState } from 'react';
import { demoJobs } from '../lib/demoData';
import { Navigation, Check, Key, PawPrint, MapPin, AlertTriangle } from 'lucide-react';
import { getMapsUrl } from '../lib/maps';

export default function Route() {
  const [jobs, setJobs] = useState(demoJobs);
  const [animating, setAnimating] = useState(null);

  function toggleStatus(job) {
    setAnimating(job.id);
    const id = setTimeout(() => {
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: j.status === 'done' ? 'scheduled' : 'done' } : j));
      setAnimating(null);
    }, 150);
  }

  const doneCount = jobs.filter(j => j.status === 'done').length;
  const allDone = doneCount === jobs.length;

  return (
    <div>
      {/* Page header */}
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Today's Route</h2>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-sm text-gray-500 dark:text-gray-400">{jobs.length} stop{jobs.length !== 1 ? 's' : ''}</p>
          <span className="text-gray-300 dark:text-gray-600">&middot;</span>
          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{doneCount} done</p>
          {allDone && <span className="badge-success text-xs">All clear! 🎉</span>}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-5 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full transition-all duration-700 ease-out" style={{ width: `${jobs.length ? (doneCount / jobs.length) * 100 : 0}%` }} />
      </div>

      {/* Route stops */}
      <div className="space-y-3">
        {jobs.map((job, i) => {
          const client = job.clients;
          const isAnimating = animating === job.id;
          const isDone = job.status === 'done';
          return (
            <div key={job.id} className={`card p-4 relative overflow-hidden transition-all duration-300 ${isAnimating ? 'scale-[0.98] opacity-70' : ''} ${isDone ? 'opacity-70' : ''}`}>
              {/* Connecting line */}
              {i < jobs.length - 1 && <div className="absolute left-[34px] top-16 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />}

              <div className="flex items-start gap-3 relative">
                {/* Stop number */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm transition-all duration-300 ${isDone ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400'}`}>
                  {isDone ? <Check className="w-4 h-4" /> : i + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{client?.name || 'Unknown'}</p>
                    {isDone && <span className="badge-success text-[10px]">Done</span>}
                  </div>
                  {client?.address && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3 flex-shrink-0" />{client.address}</p>}

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {client?.key_code && <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1"><Key className="w-3 h-3" />{client.key_code}</span>}
                    {client?.alarm_code && <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-2 py-1"><AlertTriangle className="w-3 h-3" />{client.alarm_code}</span>}
                    {client?.pet_instructions && <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1"><PawPrint className="w-3 h-3" />{client.pet_instructions}</span>}
                  </div>
                </div>

                <div className="flex flex-col gap-2 items-end flex-shrink-0">
                  <button onClick={() => toggleStatus(job)} aria-label="Toggle job status" className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 ${isDone ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/60'}`}>
                    {isDone ? <span className="flex items-center gap-1"><Check className="w-3 h-3" />Done</span> : 'Mark Done'}
                  </button>
                  {client?.address && (
                    <a href={getMapsUrl(client.address)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 font-medium hover:text-sky-700 dark:hover:text-sky-300 transition-colors">
                      <Navigation className="w-3 h-3" />Navigate
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
