import React, { useState, useEffect } from 'react';
import { Database, FileSpreadsheet, Upload, CheckCircle2, AlertCircle, ArrowLeft, Check } from 'lucide-react';
import { connectPostgres, uploadFile, getDataSources, deleteDataSource } from '../services/api';

export default function DataSourcesPage({ activeDataSource, onConnectSuccess, onSelectDataSource }) {
  const [dataSources, setDataSources] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState('connect'); // 'connect' | 'upload'

  const [pgForm, setPgForm] = useState({
    name: '',
    type: 'postgres',
    host: '',
    port: '',
    database: '',
    schema: '',
    user: '',
    password: ''
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const fetchSources = async () => {
    setFetching(true);
    try {
      const res = await getDataSources();
      if (res.success && Array.isArray(res.dataSources)) {
        setDataSources(res.dataSources);
      }
    } catch (err) {
      console.error('Error loading data sources:', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handlePgChange = (e) => {
    setPgForm({ ...pgForm, [e.target.name]: e.target.value });
  };

  const getDbPlaceholders = (type) => {
    switch (type) {
      case 'mysql':
        return {
          name: 'e.g. Local MySQL Database',
          host: 'localhost',
          port: '3306',
          database: 'mysql / sys',
          schema: 'N/A (MySQL default)',
          user: 'root',
          password: 'Enter MySQL root password'
        };
      case 'sqlserver':
        return {
          name: 'e.g. Enterprise SQL Server Database',
          host: 'localhost',
          port: '1433',
          database: 'master',
          schema: 'dbo',
          user: 'sa',
          password: 'Enter SQL Server SA password'
        };
      case 'sqlite':
        return {
          name: 'e.g. Local SQLite Database',
          host: 'localhost',
          port: '0',
          database: 'local_database.sqlite',
          schema: 'main',
          user: 'admin',
          password: 'N/A (No password required)'
        };
      case 'postgres':
      default:
        return {
          name: 'e.g. Local PostgreSQL Database',
          host: 'localhost',
          port: '5432',
          database: 'datamind_app / postgres',
          schema: 'public',
          user: 'postgres',
          password: 'Enter PostgreSQL password'
        };
    }
  };

  const handlePgSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!pgForm.type) {
      setError('Please select a database type.');
      return;
    }

    const ph = getDbPlaceholders(pgForm.type);
    const rawHost = (pgForm.host || ph.host).trim();
    const cleanHost = rawHost.split(':')[0] || 'localhost';

    setLoading(true);
    try {
      const res = await connectPostgres({
        name: pgForm.name || pgForm.database || ph.name,
        type: pgForm.type,
        host: cleanHost,
        port: Number(pgForm.port) || Number(ph.port) || 5432,
        database: pgForm.database || (pgForm.type === 'mysql' ? 'mysql' : 'datamind_app'),
        schema: pgForm.schema || (pgForm.type === 'sqlserver' ? 'dbo' : 'public'),
        user: pgForm.user || ph.user,
        password: pgForm.password
      });

      if (res.success && res.dataSource) {
        setSuccessMsg(`Successfully connected database "${res.dataSource.name}"!`);
        setDataSources(prev => [res.dataSource, ...prev]);
        setIsAdding(false);
        if (onConnectSuccess) onConnectSuccess(res.dataSource);
        if (onSelectDataSource) onSelectDataSource(res.dataSource);
      } else {
        setError(res.error || 'Failed to connect to database');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Connection failed. Please check host, username and password.');
    } finally {
      setLoading(false);
    }
  };

  const currentPh = getDbPlaceholders(pgForm.type);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await uploadFile(selectedFile);
      if (res.success && res.dataSource) {
        setSuccessMsg(`File "${selectedFile.name}" converted and imported as SQL dataset!`);
        setSelectedFile(null);
        setDataSources(prev => [res.dataSource, ...prev]);
        setIsAdding(false);
        if (onConnectSuccess) onConnectSuccess(res.dataSource);
        if (onSelectDataSource) onSelectDataSource(res.dataSource);
      } else {
        setError(res.error || 'Failed to process file');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error processing dataset file');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (ds) => {
    setError(null);
    setSuccessMsg(`Switched active data source to "${ds.name}"!`);
    if (onSelectDataSource) onSelectDataSource(ds);
    if (onConnectSuccess) onConnectSuccess(ds);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this data source?')) return;
    try {
      const res = await deleteDataSource(id);
      if (res.success) {
        setDataSources(prev => prev.filter(ds => String(ds.id || ds._id) !== String(id)));
      }
    } catch (err) {
      alert('Error deleting data source');
    }
  };

  return (
    <div className="flex-1 h-screen bg-[#18181b] text-slate-100 overflow-y-auto p-6 md:p-8 font-sans antialiased">
      <div className="max-w-6xl w-full mx-auto space-y-6">

        {error && (
          <div className="p-4 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-sm flex items-center gap-2.5 font-medium shadow-lg">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-sm flex items-center gap-2.5 font-medium shadow-lg">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {!isAdding ? (
          <>
            <div className="bg-[#222226] border border-[#2e2e36] rounded-2xl p-6 md:p-7 shadow-xl flex items-center justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-1.5">Data sources</h1>
                <p className="text-sm md:text-base text-zinc-300 font-medium">Manage your data sources</p>
              </div>

              <button
                onClick={() => { setIsAdding(true); setError(null); setSuccessMsg(null); }}
                className="px-5 py-2.5 bg-[#5850ec] hover:bg-[#4f46e5] text-white font-bold text-sm rounded-xl transition cursor-pointer shadow-sm active:scale-[0.98]"
              >
                <span>Add new</span>
              </button>
            </div>

            <div className="bg-[#222226] border border-[#2e2e36] rounded-2xl p-6 md:p-7 shadow-xl space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white mb-0.5">All data sources</h2>
                <p className="text-sm text-zinc-400">Connections, health and quick actions</p>
              </div>

              {fetching ? (
                <div className="py-12 text-center text-zinc-400 text-sm font-medium">
                  Loading data sources...
                </div>
              ) : dataSources.length === 0 ? (
                <div className="py-14 border border-dashed border-[#33333b] rounded-2xl text-center space-y-3.5">
                  <h3 className="text-lg font-bold text-white">No data sources yet</h3>
                  <p className="text-sm text-zinc-400 max-w-sm mx-auto font-medium">
                    Connect your first database to start asking questions.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => { setIsAdding(true); setError(null); setSuccessMsg(null); }}
                      className="px-5 py-2.5 bg-[#5850ec] hover:bg-[#4f46e5] text-white font-bold text-sm rounded-xl transition cursor-pointer shadow-sm active:scale-[0.98]"
                    >
                      <span>Add data source</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {dataSources.map((ds) => {
                    const isSelected = activeDataSource && String(ds.id || ds._id) === String(activeDataSource.id || activeDataSource._id);
                    return (
                      <div
                        key={ds.id || ds._id}
                        className={`p-4 md:p-5 rounded-2xl border transition shadow-md flex flex-col gap-4 ${
                          isSelected
                            ? 'bg-[#1e1e24] border-[#5850ec]/60'
                            : 'bg-[#18181b] border-[#2e2e36] hover:bg-[#25252b]'
                        }`}
                      >
                        {/* Top: Dataset Name & Active Indicator */}
                        <div className="flex items-start justify-between gap-3 min-w-0">
                          <div className="flex items-start space-x-3 min-w-0 flex-1">
                            <div className="p-2.5 bg-[#222226] border border-[#33333b] rounded-xl text-indigo-400 shrink-0 mt-0.5">
                              <Database className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-bold text-white text-base md:text-lg break-all leading-snug">
                                {ds.name}
                              </h3>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="px-3 py-1 bg-indigo-950 border border-indigo-700/60 text-indigo-300 rounded-lg text-xs font-bold shrink-0">
                              Active
                            </span>
                          )}
                        </div>

                        {/* Options & Actions placed below dataset name */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#2e2e36]/80">
                          <div className="flex items-center space-x-2">
                            <span className="px-3 py-1 bg-[#222226] border border-[#33333b] uppercase text-xs font-bold text-zinc-300 rounded-lg tracking-wider">
                              {ds.type}
                            </span>
                            <span className="px-3 py-1 bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 rounded-lg text-xs font-semibold">
                              {ds.status || 'Active'}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2.5">
                            {isSelected ? (
                              <span className="px-4 py-2 bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 text-xs md:text-sm font-bold rounded-xl flex items-center space-x-1.5 shadow-sm">
                                <Check className="w-4 h-4 text-emerald-400" />
                                <span>Selected</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handleSelect(ds)}
                                className="px-4 py-2 bg-[#5850ec] hover:bg-[#4f46e5] text-white text-xs md:text-sm font-bold rounded-xl transition cursor-pointer shadow-sm active:scale-[0.98]"
                              >
                                Select
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(ds.id || ds._id)}
                              className="px-3.5 py-2 border border-rose-800/80 hover:bg-rose-950/40 text-rose-400 text-xs md:text-sm font-bold rounded-xl transition cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="bg-[#222226] border border-[#2e2e36] rounded-2xl p-6 md:p-7 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-1.5">Data sources</h1>
                <p className="text-sm md:text-base text-zinc-300 font-medium">Manage your connected databases and CSV/Excel files</p>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <div className="flex items-center space-x-2 bg-[#18181b] p-1.5 rounded-xl border border-[#33333b]">
                  <button
                    onClick={() => { setActiveTab('connect'); setError(null); setSuccessMsg(null); }}
                    className={`px-4 py-2.5 rounded-lg text-xs md:text-sm font-bold transition flex items-center space-x-2 cursor-pointer ${activeTab === 'connect'
                        ? 'bg-[#5850ec] text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                      }`}
                  >
                    <Database className="w-4 h-4" />
                    <span>Add SQL Database</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('upload'); setError(null); setSuccessMsg(null); }}
                    className={`px-4 py-2.5 rounded-lg text-xs md:text-sm font-bold transition flex items-center space-x-2 cursor-pointer ${activeTab === 'upload'
                        ? 'bg-[#5850ec] text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                      }`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Upload File (CSV/Excel)</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2.5 border border-[#383842] hover:border-zinc-500 bg-[#18181b] text-zinc-200 font-bold text-xs md:text-sm rounded-xl transition cursor-pointer flex items-center space-x-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to list</span>
                </button>
              </div>
            </div>

            {activeTab === 'connect' && (
              <div className="bg-[#222226] border border-[#2e2e36] rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Add data source</h2>
                  <p className="text-sm text-zinc-400 font-medium">Connect an external database</p>
                </div>

                <form onSubmit={handlePgSubmit} autoComplete="off" className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-zinc-200 mb-1.5">Name</label>
                    <input
                      type="text"
                      name="name"
                      autoComplete="off"
                      value={pgForm.name}
                      onChange={handlePgChange}
                      placeholder={currentPh.name}
                      className="w-full bg-[#18181b] border border-[#383842] focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 transition"
                    />
                  </div>

                  <div className="p-5 bg-[#18181b] border border-[#2e2e36] rounded-xl space-y-4 relative pt-6">
                    <span className="absolute -top-3 left-4 bg-[#222226] px-2 text-xs font-bold text-zinc-200">
                      Connection basics
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-zinc-200 mb-1.5">Database type</label>
                        <select
                          name="type"
                          value={pgForm.type}
                          onChange={handlePgChange}
                          required
                          className="w-full bg-[#18181b] border border-[#383842] focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white transition cursor-pointer font-medium"
                        >
                          <option value="postgres">PostgreSQL</option>
                          <option value="mysql">MySQL</option>
                          <option value="sqlserver">SQL Server</option>
                          <option value="sqlite">SQLite</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-zinc-200 mb-1.5">Host</label>
                        <input
                          type="text"
                          name="host"
                          autoComplete="off"
                          value={pgForm.host}
                          onChange={handlePgChange}
                          placeholder={currentPh.host}
                          className="w-full bg-[#18181b] border border-[#383842] focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-zinc-200 mb-1.5">Port</label>
                        <input
                          type="text"
                          name="port"
                          autoComplete="off"
                          value={pgForm.port}
                          onChange={handlePgChange}
                          placeholder={currentPh.port}
                          className="w-full bg-[#18181b] border border-[#383842] focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-zinc-200 mb-1.5">Database</label>
                        <input
                          type="text"
                          name="database"
                          autoComplete="off"
                          value={pgForm.database}
                          onChange={handlePgChange}
                          placeholder={currentPh.database}
                          className="w-full bg-[#18181b] border border-[#383842] focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-zinc-200 mb-1.5">Schema</label>
                      <input
                        type="text"
                        name="schema"
                        autoComplete="off"
                        value={pgForm.schema}
                        onChange={handlePgChange}
                        placeholder={currentPh.schema}
                        className="w-full bg-[#18181b] border border-[#383842] focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 transition"
                      />
                    </div>
                  </div>

                  <div className="p-5 bg-[#18181b] border border-[#2e2e36] rounded-xl space-y-4 relative pt-6">
                    <span className="absolute -top-3 left-4 bg-[#222226] px-2 text-xs font-bold text-zinc-200">
                      Credentials
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-zinc-200 mb-1.5">Username</label>
                        <input
                          type="text"
                          name="user"
                          autoComplete="off"
                          value={pgForm.user}
                          onChange={handlePgChange}
                          placeholder={currentPh.user}
                          className="w-full bg-[#18181b] border border-[#383842] focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-zinc-200 mb-1.5">Password</label>
                        <input
                          type="password"
                          name="password"
                          autoComplete="new-password"
                          value={pgForm.password}
                          onChange={handlePgChange}
                          placeholder={currentPh.password}
                          className="w-full bg-[#18181b] border border-[#383842] focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 transition"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center space-x-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-3 bg-[#5850ec] hover:bg-[#4f46e5] text-white font-bold text-sm rounded-xl transition cursor-pointer shadow-md active:scale-[0.98] disabled:opacity-40"
                    >
                      {loading ? 'Connecting database...' : 'Save data source'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="px-5 py-3 bg-[#18181b] hover:bg-[#28282e] border border-[#383842] text-zinc-200 font-bold text-sm rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'upload' && (
              <div className="bg-[#222226] border border-[#2e2e36] rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Upload CSV or Excel dataset</h2>
                  <p className="text-sm text-zinc-400 font-medium">Instantly convert files into queryable SQL datasets</p>
                </div>

                <form onSubmit={handleFileUpload} className="space-y-6">
                  <div className="border-2 border-dashed border-[#383842] hover:border-[#5850ec] bg-[#18181b] rounded-2xl p-8 text-center transition cursor-pointer relative">
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,.sqlite,.db"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Upload className="w-8 h-8 text-zinc-400" />
                      <div className="text-sm text-zinc-200 font-bold">
                        {selectedFile ? (
                          <span className="text-indigo-400">{selectedFile.name}</span>
                        ) : (
                          <span>Click to upload or drag and drop</span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 font-medium">Supports .csv, .xlsx, .xls up to 50MB</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      type="submit"
                      disabled={loading || !selectedFile}
                      className="px-6 py-3 bg-[#5850ec] hover:bg-[#4f46e5] text-white font-bold text-sm rounded-xl transition cursor-pointer shadow-md active:scale-[0.98] disabled:opacity-40"
                    >
                      {loading ? 'Converting file to SQL...' : 'Upload Data Source'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="px-5 py-3 bg-[#18181b] hover:bg-[#28282e] border border-[#383842] text-zinc-200 font-bold text-sm rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
