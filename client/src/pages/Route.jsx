import { useState } from 'react';
import { demoJobs } from '../lib/demoData';
import { Navigation, Check, Key, PawPrint, MapPin } from 'lucide-react';

export default function Route() {
  const [jobs, setJobs] = useState(demoJobs);

  function toggleStatus(job) {
    setJobs(jobs.map(j => j.id === job.id ? { ...j, status: j.status === 'done' ? 'scheduled' : 'done' } : j));
  }

  const doneCount = jobs.filter(j => j.status === 'done').length;

  return (
    <div>
      {/* Page header */}
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900">Today's Route</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {jobs.length} stop{jobs.length !== 1 ? 's' : ''} &middot; {doneCount} done
        </p>
      </div>

      {/* Route stops */}
      <div className="space-y-3">
        {jobs.map((job, i) => {
          const client = job.clients;
          return (
            <div key={job.id} className={`card p-4 transition-opacity duration-200 ${job.status === 'done' ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-3">
                {/* Stop number */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors duration-200 ${
                  job.status === 'done'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-sky-100 text-sky-700'
                }`}>
                  {i + 1}
                </div>

                {/* Client info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{client?.name || 'Unknown'}</p>
                  {client?.address && (
                    <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {client.address}
                    </p>
                  )}

                  {/* Details */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {client?.key_code && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-lg px-2 py-1">
                        <Key className="w-3 h-3" />
                        {client.key_code}
                      </span>
                    )}
                    {client?.alarm_code && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1">
                        Alarm: {client.alarm_code}
                      </span>
                    )}
                    {client?.pet_instructions && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-lg px-2 py-1">
                        <PawPrint className="w-3 h-3" />
                        {client.pet_instructions}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 items-end flex-shrink-0">
                  <button
                    onClick={() => toggleStatus(job)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 ${
                      job.status === 'done'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    }`}
                  >
                    {job.status === 'done' ? (
                      <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Done</span>
                    ) : 'Mark Done'}
                  </button>
                  {client?.address && (
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(client.address)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-sky-600 font-medium hover:text-sky-700 transition-colors"
                    >
                      <Navigation className="w-3 h-3" />
                      Navigate
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
