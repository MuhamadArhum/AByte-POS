import { useState, useEffect } from 'react';
import { Database, Download, Trash2, Upload, Loader2, AlertTriangle, Check, HardDrive } from 'lucide-react';
import api from '../utils/api';

interface BackupEntry {
  backup_id: number;
  filename: string;
  file_size: number;
  created_by_name: string;
  created_at: string;
  type: 'manual' | 'scheduled';
  status: 'completed' | 'failed';
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const Backup = () => {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    try {
      const res = await api.get('/backup');
      setBackups(res.data);
    } catch (error) {
      console.error('Failed to fetch backups', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.post('/backup');
      setMessage({ type: 'success', text: `Backup created: ${res.data.filename}` });
      fetchBackups();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to create backup' });
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (filename: string) => {
    if (!window.confirm(`WARNING: Restoring will overwrite the current database with "${filename}".\n\nA backup of the current state will be created first.\n\nAre you sure you want to continue?`)) {
      return;
    }
    setRestoring(filename);
    setMessage({ type: '', text: '' });
    try {
      await api.post('/backup/restore', { filename });
      setMessage({ type: 'success', text: 'Backup restored successfully. Please refresh the page.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to restore backup' });
    } finally {
      setRestoring(null);
    }
  };

  const handleDownload = (filename: string) => {
    window.open(`/api/backup/download/${filename}`, '_blank');
  };

  const handleDelete = async (filename: string) => {
    if (!window.confirm(`Delete backup "${filename}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/backup/${filename}`);
      setMessage({ type: 'success', text: 'Backup deleted' });
      fetchBackups();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to delete backup' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Database className="text-emerald-600" size={32} />
            Backup & Restore
          </h1>
          <p className="text-gray-500 mt-1">Manage database backups</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          {creating ? <Loader2 className="animate-spin" size={20} /> : <HardDrive size={20} />}
          Create Backup Now
        </button>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <Check size={20} /> : <AlertTriangle size={20} />}
          <span className="font-medium">{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto text-sm opacity-60 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* Backups Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">Backup History ({backups.length})</h3>
        </div>

        {backups.length === 0 ? (
          <div className="p-12 text-center">
            <Database size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No backups yet. Create your first backup.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 font-medium">
              <tr>
                <th className="p-4">Filename</th>
                <th className="p-4">Size</th>
                <th className="p-4">Created</th>
                <th className="p-4">By</th>
                <th className="p-4">Type</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {backups.map((backup) => (
                <tr key={backup.backup_id} className="hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-800 font-mono text-xs">{backup.filename}</td>
                  <td className="p-4 text-gray-600">{formatFileSize(Number(backup.file_size))}</td>
                  <td className="p-4 text-gray-500">{new Date(backup.created_at).toLocaleString()}</td>
                  <td className="p-4 text-gray-600">{backup.created_by_name}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      backup.type === 'scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {backup.type}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      backup.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {backup.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDownload(backup.filename)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => handleRestore(backup.filename)}
                        disabled={restoring === backup.filename}
                        className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Restore"
                      >
                        {restoring === backup.filename ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      </button>
                      <button
                        onClick={() => handleDelete(backup.filename)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Backup;
