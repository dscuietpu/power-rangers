'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Check, X, Eye, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { assignVolunteerRole } from '@/app/actions/userActions';

interface VolunteerApplication {
  id: string;
  skills: string[];
  transport_type: string;
  id_document_url: string;
  status: string;
  created_at: string;
  profiles: {
    name: string;
    phone: string;
  };
}

export default function AdminVolunteersPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<VolunteerApplication[]>([]);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') {
        toast.error('Unauthorized access. Admins only.');
        router.push('/');
        return;
      }

      setIsAdmin(true);
      fetchApplications();
    }
    
    init();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('volunteer_profiles')
      .select('*, profiles(name, phone)')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load applications');
    } else {
      setApplications(data as any);
    }
    setLoading(false);
  };

  const handleAction = async (id: string, action: 'approved' | 'rejected') => {
    // 1. Update volunteer_profiles status
    const { error: vpError } = await supabase
      .from('volunteer_profiles')
      .update({ status: action })
      .eq('id', id);

    if (vpError) {
      toast.error(`Failed to update application status: ${vpError.message}`);
      return;
    }

    // 2. If approved, use server action to update profiles role to volunteer
    if (action === 'approved') {
      const result = await assignVolunteerRole(id, 'volunteer');
      if (result.error) {
        toast.error(`Status updated, but failed to assign volunteer role: ${result.error}`);
        return;
      }
    } else {
       // If rejected, ensure role is reset to user in case they were previously approved
       const result = await assignVolunteerRole(id, 'user');
       if (result.error) {
          toast.error(`Status updated, but failed to reset user role: ${result.error}`);
       }
    }

    toast.success(`Application marked as ${action}`);
    fetchApplications();
  };

  if (loading) {
    return <div className="h-screen bg-slate-950 flex items-center justify-center text-white">Loading Admin Portal...</div>;
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8 border-b border-slate-800 pb-6">
          <ShieldAlert className="w-8 h-8 text-red-500" />
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-slate-400">Manage Volunteer Applications</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800 border-b border-slate-700">
                <th className="p-4 text-sm font-semibold text-slate-300">Name / Phone</th>
                <th className="p-4 text-sm font-semibold text-slate-300">Skills</th>
                <th className="p-4 text-sm font-semibold text-slate-300">Transport</th>
                <th className="p-4 text-sm font-semibold text-slate-300">Status</th>
                <th className="p-4 text-sm font-semibold text-slate-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">No applications found.</td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4">
                      <div className="font-medium text-white">{app.profiles?.name || 'Unknown'}</div>
                      <div className="text-sm text-slate-400">{app.profiles?.phone || 'N/A'}</div>
                      <div className="text-xs text-slate-600 mt-1">{new Date(app.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {app.skills?.map(s => (
                          <span key={s} className="px-2 py-0.5 bg-blue-900/30 text-blue-300 rounded text-xs border border-blue-800/50">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-300">
                      {app.transport_type}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium uppercase tracking-wider ${
                        app.status === 'approved' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50' : 
                        app.status === 'rejected' ? 'bg-red-900/40 text-red-400 border border-red-800/50' : 
                        'bg-orange-900/40 text-orange-400 border border-orange-800/50'
                      }`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                       {app.id_document_url && (
                        <button 
                          onClick={() => window.open(app.id_document_url, '_blank')}
                          className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-900/20 rounded transition-colors"
                          title="View ID"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      )}
                      {app.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => handleAction(app.id, 'approved')}
                            className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/20 rounded transition-colors"
                            title="Approve"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleAction(app.id, 'rejected')}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                            title="Reject"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
