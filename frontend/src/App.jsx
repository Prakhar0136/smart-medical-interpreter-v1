// frontend/src/App.jsx
import { useState, useEffect } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
} from "@clerk/clerk-react";
import {
  Upload,
  Activity,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  TrendingUp,
  ShieldCheck,
  Lock,
  Download,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState([]);
  const [selectedBiomarker, setSelectedBiomarker] = useState("Glucose");
  const [latestAnalysis, setLatestAnalysis] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { userId, isLoaded } = useAuth();
  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

  useEffect(() => {
    const loadData = async () => {
      if (!userId) return;
      
      try {
        const res = await fetch(`${API_BASE_URL}/api/records/trends/${userId}`);
        const result = await res.json();
        if (result.success && result.timeline.length > 0) {
          setTimeline(result.timeline);
          setLatestAnalysis(result.timeline[result.timeline.length - 1]);
        }
      } catch (err) {
        console.error("Error fetching patient timeline history:", err);
      }
    };

    if (isLoaded) {
      loadData();
    }
  }, [refreshKey, userId, isLoaded]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file || !userId) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("document", file);
    formData.append("userId", userId);

    try {
      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (result.success) {
        alert("Document analyzed and securely stored!");
        setFile(null);
        setRefreshKey((prev) => prev + 1);
      } else {
        alert(`Analysis Error: ${result.error || result.details}`);
      }
    } catch (err) {
      console.error("Upload sequence failed:", err);
      alert("Failed to communicate with orchestration engine.");
    } finally {
      setLoading(false);
    }
  };

  const getGraphData = () => {
    return timeline
      .map((record) => {
        const metric = record.biomarkers.find(
          (b) => b.name.toLowerCase() === selectedBiomarker.toLowerCase(),
        );
        return {
          date: new Date(record.recordDate).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          [selectedBiomarker]: metric ? parseFloat(metric.value) : null,
          unit: metric ? metric.unit : "",
        };
      })
      .filter((d) => d[selectedBiomarker] !== null);
  };

  // NEW FEATURE: Generate and download a CSV of all historical lab data
  const downloadCSV = () => {
    if (timeline.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Biomarker,Value,Unit,Status\n";

    timeline.forEach((record) => {
      const date = new Date(record.recordDate).toLocaleDateString();
      record.biomarkers.forEach((b) => {
        // Enclose text in quotes to prevent comma-separation issues
        csvContent += `"${date}","${b.name}","${b.value}","${b.unit}","${b.status}"\n`;
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "medical_timeline_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-indigo-600 animate-pulse" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Smart Medical Interpreter
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-200">
              <ShieldCheck className="h-4 w-4" /> Privacy Shield Active
            </div>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>

      <SignedIn>
        <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold mb-4 text-slate-900 flex items-center gap-2">
                <Upload className="h-5 w-5 text-indigo-500" /> Upload New Report
              </h2>
              <form onSubmit={handleUploadSubmit} className="space-y-4">
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-6 cursor-pointer hover:bg-slate-50 transition bg-slate-50/50">
                  <Upload className="h-8 w-8 text-slate-400 mb-2" />
                  <span className="text-sm font-medium text-slate-600 text-center">
                    {file ? file.name : "Select medical scan (Image or PDF)"}
                  </span>
                  <input
                    type="file"
                    accept="image/*, application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <button
                  type="submit"
                  disabled={!file || loading}
                  className={`w-full py-2.5 rounded-xl text-white font-semibold transition text-sm ${
                    !file || loading
                      ? "bg-slate-300 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200"
                  }`}
                >
                  {loading
                    ? "Executing Engine Runtimes..."
                    : "Analyze Document"}
                </button>
              </form>
            </div>

            {latestAnalysis && (
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-slate-100 p-6 rounded-2xl shadow-xl">
                <h2 className="text-base font-bold mb-3 flex items-center gap-2 tracking-wide">
                  <HelpCircle className="h-5 w-5 text-indigo-400" /> Questions
                  For Your Doctor
                </h2>
                <ul className="space-y-3">
                  {latestAnalysis.questionsForDoctor.map((q, idx) => (
                    <li
                      key={idx}
                      className="bg-white/5 p-3 rounded-xl border border-white/10 text-xs leading-relaxed text-indigo-100"
                    >
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-8">
            {latestAnalysis ? (
              <>
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-bold text-indigo-950 mb-2 text-base">
                      Patient Summary Insight
                    </h2>
                    <p className="text-sm text-indigo-900/90 leading-relaxed font-medium">
                      {latestAnalysis.explanation}
                    </p>
                  </div>
                  {/* CSV Download Button */}
                  <button
                    onClick={downloadCSV}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition whitespace-nowrap"
                  >
                    <Download className="h-4 w-4" /> Export Data
                  </button>
                </div>

                <div>
                  <h3 className="text-sm font-bold tracking-wider text-slate-400 uppercase mb-4">
                    Current Biomarker Status
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {latestAnalysis.biomarkers.map((biomarker, idx) => {
                      const isHighLow =
                        biomarker.status.toLowerCase() === "high" ||
                        biomarker.status.toLowerCase() === "low";
                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedBiomarker(biomarker.name)}
                          className={`p-5 rounded-2xl border transition cursor-pointer shadow-sm ${
                            selectedBiomarker.toLowerCase() ===
                            biomarker.name.toLowerCase()
                              ? "ring-2 ring-indigo-600 scale-[1.01]"
                              : ""
                          } ${isHighLow ? "bg-amber-50/50 border-amber-200" : "bg-emerald-50/30 border-emerald-200"}`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                {biomarker.name}
                              </p>
                              <p className="text-2xl font-black mt-2 text-slate-900">
                                {biomarker.value}{" "}
                                <span className="text-sm font-medium text-slate-500">
                                  {biomarker.unit}
                                </span>
                              </p>
                            </div>
                            {isHighLow ? (
                              <span className="flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">
                                <AlertTriangle className="h-3 w-3" />{" "}
                                {biomarker.status}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                                <CheckCircle className="h-3 w-3" /> Optimal
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {timeline.length > 1 && (
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-base font-bold mb-4 text-slate-900 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-indigo-500" />{" "}
                      Historical Trend:{" "}
                      <span className="text-indigo-600">
                        {selectedBiomarker}
                      </span>
                    </h3>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={getGraphData()}
                          margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f1f5f9"
                          />
                          <XAxis
                            dataKey="date"
                            stroke="#94a3b8"
                            fontSize={11}
                            tickLine={false}
                          />
                          <YAxis
                            stroke="#94a3b8"
                            fontSize={11}
                            tickLine={false}
                            domain={["dataMin - 10", "dataMax + 10"]}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "#0f172a",
                              borderRadius: "12px",
                              border: "none",
                              color: "#fff",
                              fontSize: "12px",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey={selectedBiomarker}
                            stroke="#4f46e5"
                            strokeWidth={3}
                            activeDot={{ r: 6 }}
                            dot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl p-16 bg-white shadow-sm text-center h-full min-h-[400px]">
                <Activity className="h-12 w-12 text-slate-300 mb-4 stroke-[1.5]" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">
                  No Medical Records Captured
                </h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Upload an image of a blood panel or lab results to generate
                  your first visual medical timeline dashboard.
                </p>
              </div>
            )}
          </div>
        </main>
      </SignedIn>

      <SignedOut>
        <main className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
          <Lock className="h-16 w-16 text-indigo-200 mb-6" />
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            Secure Medical Portal
          </h2>
          <p className="text-slate-500 max-w-md mb-8">
            Sign in to upload lab reports, generate personalized AI insights,
            and securely track your health biomarkers over time.
          </p>
          <SignInButton mode="modal">
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-indigo-200 transition">
              Access Dashboard
            </button>
          </SignInButton>
        </main>
      </SignedOut>
    </div>
  );
}
