/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Bookmark, 
  Home, 
  BarChart3, 
  Menu, 
  X,
  RotateCcw,
  Trophy,
  Target,
  Timer as TimerIcon
} from 'lucide-react';
import { generateQuestions } from './services/geminiService';
import { Question, PHYSICS_CHAPTERS, CHEMISTRY_SECTIONS, BIOLOGY_SECTIONS, PHYSICS_TOPICS } from './types';

type AppState = 'LANDING' | 'SELECTION' | 'EXAM' | 'RESULT' | 'SAVED_QUESTIONS' | 'GENERATING';

interface ExamConfig {
  subjects: string[];
  biologySections: string[];
  chemistrySections: string[];
  physicsChapters: string[];
}

interface UserAnswer {
  questionId: string;
  selectedOption: number | null;
  isMarkedForReview: boolean;
}

export default function App() {
  const [state, setState] = useState<AppState>('LANDING');
  const [config, setConfig] = useState<ExamConfig>({
    subjects: [],
    biologySections: [],
    chemistrySections: [],
    physicsChapters: []
  });
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, UserAnswer>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isExamActive, setIsExamActive] = useState(false);
  const [savedQuestionIds, setSavedQuestionIds] = useState<string[]>([]);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [reviewPage, setReviewPage] = useState(0);
  const [palettePage, setPalettePage] = useState(0);
  const REVIEW_PAGE_SIZE = 45;
  const PALETTE_PAGE_SIZE = 45;

  // Load saved questions from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('neet_saved_questions');
    if (saved) {
      setSavedQuestionIds(JSON.parse(saved));
    }
  }, []);

  const saveToLocalStorage = (ids: string[]) => {
    localStorage.setItem('neet_saved_questions', JSON.stringify(ids));
    setSavedQuestionIds(ids);
  };

  const toggleSaveQuestion = (id: string, questionObj?: Question) => {
    const isSaved = savedQuestionIds.includes(id);
    const newSavedIds = isSaved
      ? savedQuestionIds.filter(sid => sid !== id)
      : [...savedQuestionIds, id];
    
    saveToLocalStorage(newSavedIds);

    // Also update the full objects store
    const currentFull = JSON.parse(localStorage.getItem('neet_saved_questions_full') || '[]');
    if (isSaved) {
      const newFull = currentFull.filter((q: Question) => q.id !== id);
      localStorage.setItem('neet_saved_questions_full', JSON.stringify(newFull));
    } else {
      const questionToSave = questionObj || questions.find(q => q.id === id);
      if (questionToSave) {
        localStorage.setItem('neet_saved_questions_full', JSON.stringify([...currentFull, questionToSave]));
      }
    }
  };

  // Timer logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isExamActive && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            submitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isExamActive, timeLeft]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startExam = async () => {
    setState('GENERATING');
    setGenerationProgress(0);
    
    let allGeneratedQuestions: Question[] = [];
    const tasks: { subject: 'Physics' | 'Chemistry' | 'Biology', count: number, subSections: string[] }[] = [];

    // Biology Logic: 45 per section (Botany/Zoology)
    if (config.subjects.includes('Biology')) {
      const sections = config.biologySections.length === 0 ? BIOLOGY_SECTIONS : config.biologySections;
      sections.forEach(section => {
        const subBatches = 3; // 15 questions per batch
        for (let i = 0; i < subBatches; i++) {
          tasks.push({ subject: 'Biology', count: 15, subSections: [section] });
        }
      });
    }
    
    // Chemistry Logic: 45 total mixed from selected sections
    if (config.subjects.includes('Chemistry')) {
      const sections = config.chemistrySections.length === 0 ? CHEMISTRY_SECTIONS : config.chemistrySections;
      const subBatches = 3; // 15 questions per batch
      for (let i = 0; i < subBatches; i++) {
        tasks.push({ subject: 'Chemistry', count: 15, subSections: sections });
      }
    }
    
    // Physics Logic: 45 total mixed from selected chapters
    if (config.subjects.includes('Physics')) {
      const chapters = config.physicsChapters.length === 0 ? PHYSICS_CHAPTERS : config.physicsChapters;
      const subBatches = 3; // 15 questions per batch
      for (let i = 0; i < subBatches; i++) {
        tasks.push({ subject: 'Physics', count: 15, subSections: chapters });
      }
    }

    try {
      // Process tasks sequentially to avoid overwhelming the connection/proxy
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const result = await generateQuestions(task.subject, task.count, task.subSections);
        allGeneratedQuestions = [...allGeneratedQuestions, ...result];
        setGenerationProgress(((i + 1) / tasks.length) * 100);
      }
      
      if (allGeneratedQuestions.length === 0) {
        alert("Failed to generate questions. Please try again.");
        setState('SELECTION');
        return;
      }

      setQuestions(allGeneratedQuestions);
      setTimeLeft(allGeneratedQuestions.length * 60); 
      setCurrentQuestionIndex(0);
      setPalettePage(0);
      setUserAnswers({});
      setIsExamActive(true);
      setState('EXAM');
    } catch (error) {
      console.error("Generation error:", error);
      alert("An error occurred while generating questions.");
      setState('SELECTION');
    }
  };

  const submitExam = () => {
    setIsExamActive(false);
    setState('RESULT');
    setShowSubmitConfirm(false);
    setReviewPage(0);
  };

  const cancelExam = () => {
    setIsExamActive(false);
    setState('LANDING');
    setShowCancelConfirm(false);
    setQuestions([]);
    setUserAnswers({});
  };

  const handleOptionSelect = (optionIndex: number) => {
    const qId = questions[currentQuestionIndex].id;
    setUserAnswers(prev => ({
      ...prev,
      [qId]: {
        ...prev[qId],
        questionId: qId,
        selectedOption: optionIndex,
      }
    }));
  };

  const toggleMarkForReview = () => {
    const qId = questions[currentQuestionIndex].id;
    setUserAnswers(prev => ({
      ...prev,
      [qId]: {
        ...prev[qId],
        questionId: qId,
        isMarkedForReview: !prev[qId]?.isMarkedForReview
      }
    }));
  };

  const calculateResults = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let unattempted = 0;

    questions.forEach(q => {
      const answer = userAnswers[q.id];
      if (!answer || answer.selectedOption === null) {
        unattempted++;
      } else if (answer.selectedOption === q.correctAnswer) {
        correct++;
      } else {
        wrong++;
      }
    });

    const score = (correct * 4) - (wrong * 1);
    const accuracy = questions.length > 0 ? (correct / (correct + wrong || 1)) * 100 : 0;

    return { correct, wrong, unattempted, score, accuracy };
  }, [questions, userAnswers]);

  // --- RENDERING ---

  const renderLanding = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full text-center space-y-8"
      >
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl mb-4">
            <BookOpen size={40} />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tight">
            NEET 2026 <span className="text-emerald-600">Mock Test</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-lg mx-auto">
            Simulate the real NEET environment with high-quality questions, 
            real-time timers, and detailed performance analytics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          {[
            { icon: <Clock className="text-blue-500" />, title: "Real Timer", desc: "3-hour full test simulation" },
            { icon: <Target className="text-red-500" />, title: "NCERT Based", desc: "Strictly follows latest syllabus" },
            { icon: <BarChart3 className="text-emerald-500" />, title: "Analytics", desc: "Deep dive into your strengths" }
          ].map((feature, i) => (
            <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="mb-2">{feature.icon}</div>
              <h3 className="font-semibold text-slate-900">{feature.title}</h3>
              <p className="text-sm text-slate-500">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <button 
            onClick={() => setState('SELECTION')}
            className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
          >
            Start Mock Test
          </button>
          <button 
            onClick={() => setState('SAVED_QUESTIONS')}
            className="px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all"
          >
            Saved Questions
          </button>
        </div>
      </motion.div>
    </div>
  );

  const renderSelection = () => (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <button onClick={() => setState('LANDING')} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <ChevronLeft />
          </button>
          <h2 className="text-3xl font-bold text-slate-900">Customize Your Test</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Biology */}
          <div className={`p-6 rounded-3xl border-2 transition-all ${config.subjects.includes('Biology') ? 'border-emerald-500 bg-emerald-50' : 'border-white bg-white shadow-sm'}`}>
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input 
                type="checkbox" 
                className="w-5 h-5 accent-emerald-600"
                checked={config.subjects.includes('Biology')}
                onChange={(e) => {
                  const subs = e.target.checked ? [...config.subjects, 'Biology'] : config.subjects.filter(s => s !== 'Biology');
                  setConfig({ ...config, subjects: subs });
                }}
              />
              <span className="text-xl font-bold text-slate-900">Biology</span>
            </label>
            {config.subjects.includes('Biology') && (
              <div className="space-y-2 pl-8">
                {BIOLOGY_SECTIONS.map(sec => (
                  <label key={sec} className="flex items-center gap-2 cursor-pointer text-slate-600">
                    <input 
                      type="checkbox" 
                      className="accent-emerald-600"
                      checked={config.biologySections.includes(sec)}
                      onChange={(e) => {
                        const secs = e.target.checked ? [...config.biologySections, sec] : config.biologySections.filter(s => s !== sec);
                        setConfig({ ...config, biologySections: secs });
                      }}
                    />
                    {sec}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Chemistry */}
          <div className={`p-6 rounded-3xl border-2 transition-all ${config.subjects.includes('Chemistry') ? 'border-blue-500 bg-blue-50' : 'border-white bg-white shadow-sm'}`}>
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input 
                type="checkbox" 
                className="w-5 h-5 accent-blue-600"
                checked={config.subjects.includes('Chemistry')}
                onChange={(e) => {
                  const subs = e.target.checked ? [...config.subjects, 'Chemistry'] : config.subjects.filter(s => s !== 'Chemistry');
                  setConfig({ ...config, subjects: subs });
                }}
              />
              <span className="text-xl font-bold text-slate-900">Chemistry</span>
            </label>
            {config.subjects.includes('Chemistry') && (
              <div className="space-y-2 pl-8">
                {CHEMISTRY_SECTIONS.map(sec => (
                  <label key={sec} className="flex items-center gap-2 cursor-pointer text-slate-600">
                    <input 
                      type="checkbox" 
                      className="accent-blue-600"
                      checked={config.chemistrySections.includes(sec)}
                      onChange={(e) => {
                        const secs = e.target.checked ? [...config.chemistrySections, sec] : config.chemistrySections.filter(s => s !== sec);
                        setConfig({ ...config, chemistrySections: secs });
                      }}
                    />
                    {sec}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Physics */}
          <div className={`p-6 rounded-3xl border-2 transition-all ${config.subjects.includes('Physics') ? 'border-red-500 bg-red-50' : 'border-white bg-white shadow-sm'}`}>
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input 
                type="checkbox" 
                className="w-5 h-5 accent-red-600"
                checked={config.subjects.includes('Physics')}
                onChange={(e) => {
                  const subs = e.target.checked ? [...config.subjects, 'Physics'] : config.subjects.filter(s => s !== 'Physics');
                  setConfig({ ...config, subjects: subs });
                }}
              />
              <span className="text-xl font-bold text-slate-900">Physics</span>
            </label>
            {config.subjects.includes('Physics') && (
              <div className="space-y-4 pl-8 max-h-80 overflow-y-auto custom-scrollbar">
                {PHYSICS_CHAPTERS.map(ch => (
                  <div key={ch} className="space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-900 font-semibold">
                      <input 
                        type="checkbox" 
                        className="accent-red-600"
                        checked={config.physicsChapters.includes(ch)}
                        onChange={(e) => {
                          const chs = e.target.checked ? [...config.physicsChapters, ch] : config.physicsChapters.filter(c => c !== ch);
                          setConfig({ ...config, physicsChapters: chs });
                        }}
                      />
                      {ch}
                    </label>
                    <div className="pl-6 text-[10px] text-slate-500 leading-tight">
                      {PHYSICS_TOPICS[ch]?.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center pt-8">
          <button 
            disabled={config.subjects.length === 0}
            onClick={startExam}
            className={`px-12 py-4 rounded-2xl font-bold text-xl transition-all shadow-lg ${config.subjects.length > 0 ? 'bg-slate-900 text-white hover:bg-black shadow-slate-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >
            Launch Exam
          </button>
        </div>
      </div>
    </div>
  );

  const renderExam = () => {
    const currentQ = questions[currentQuestionIndex];
    if (!currentQ) return null;

    const answer = userAnswers[currentQ.id];

    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Header */}
        <header className="bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <h1 className="font-bold text-lg hidden md:block">NEET 2026 Mock Test</h1>
            <div className="bg-slate-800 px-3 py-1 rounded-lg flex items-center gap-2">
              <TimerIcon size={18} className="text-emerald-400" />
              <span className="font-mono text-xl">{formatTime(timeLeft)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowCancelConfirm(true)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold transition-colors text-sm"
            >
              Cancel Exam
            </button>
            <button 
              onClick={() => setShowSubmitConfirm(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-bold transition-colors text-sm"
            >
              Submit Test
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Question Area */}
          <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Question {currentQuestionIndex + 1} of {questions.length}</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      currentQ.subject === 'Biology' ? 'bg-emerald-100 text-emerald-700' :
                      currentQ.subject === 'Chemistry' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {currentQ.subject} {currentQ.section ? `• ${currentQ.section}` : `• ${currentQ.chapter}`}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600`}>
                      {currentQ.difficulty}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => toggleSaveQuestion(currentQ.id, currentQ)}
                  className={`p-2 rounded-full transition-colors ${savedQuestionIds.includes(currentQ.id) ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:bg-slate-100'}`}
                >
                  <Bookmark fill={savedQuestionIds.includes(currentQ.id) ? "currentColor" : "none"} />
                </button>
              </div>

              <div className="text-xl text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
                {currentQ.question}
              </div>

              <div className="space-y-3">
                {currentQ.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleOptionSelect(idx)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 group ${
                      answer?.selectedOption === idx 
                        ? 'border-emerald-500 bg-emerald-50' 
                        : 'border-slate-100 hover:border-slate-200 bg-white'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-colors ${
                      answer?.selectedOption === idx 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-slate-700">{opt}</span>
                  </button>
                ))}
              </div>
            </div>
          </main>

          {/* Navigation Panel */}
          <aside className="w-full md:w-80 bg-slate-50 border-l border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-white flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900">Question Palette</h3>
                {Math.ceil(questions.length / PALETTE_PAGE_SIZE) > 1 && (
                  <div className="flex items-center gap-1">
                    <button 
                      disabled={palettePage === 0}
                      onClick={() => setPalettePage(prev => prev - 1)}
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-[10px] font-bold text-slate-500">
                      {palettePage + 1}/{Math.ceil(questions.length / PALETTE_PAGE_SIZE)}
                    </span>
                    <button 
                      disabled={palettePage === Math.ceil(questions.length / PALETTE_PAGE_SIZE) - 1}
                      onClick={() => setPalettePage(prev => prev + 1)}
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-5 gap-2 overflow-y-auto custom-scrollbar p-1 flex-1">
                {questions.slice(palettePage * PALETTE_PAGE_SIZE, (palettePage + 1) * PALETTE_PAGE_SIZE).map((q, pIdx) => {
                  const idx = palettePage * PALETTE_PAGE_SIZE + pIdx;
                  const ans = userAnswers[q.id];
                  let bgColor = 'bg-white border-slate-200 text-slate-400';
                  if (ans?.isMarkedForReview) bgColor = 'bg-purple-500 border-purple-500 text-white';
                  else if (ans?.selectedOption !== null && ans?.selectedOption !== undefined) bgColor = 'bg-emerald-500 border-emerald-500 text-white';
                  
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`w-10 h-10 rounded-lg border-2 font-bold text-sm flex items-center justify-center transition-all ${
                        currentQuestionIndex === idx ? 'ring-2 ring-slate-900 ring-offset-2' : ''
                      } ${bgColor}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="p-4 space-y-3 mt-auto bg-white border-t border-slate-200">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-3 h-3 rounded bg-emerald-500"></div> Answered
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-3 h-3 rounded bg-purple-500"></div> Marked
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-3 h-3 rounded bg-white border border-slate-200"></div> Not Visited
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Footer Controls */}
        <footer className="bg-white border-t border-slate-200 p-4 flex items-center justify-between">
          <div className="flex gap-2">
            <button 
              onClick={toggleMarkForReview}
              className={`px-4 py-2 rounded-xl font-bold transition-all border-2 ${
                answer?.isMarkedForReview 
                  ? 'bg-purple-100 border-purple-500 text-purple-700' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Mark for Review
            </button>
            <button 
              onClick={() => handleOptionSelect(null as any)}
              className="px-4 py-2 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
            >
              Clear Response
            </button>
          </div>
          <div className="flex gap-2">
            <button 
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
              className="p-2 bg-slate-100 text-slate-600 rounded-xl disabled:opacity-50"
            >
              <ChevronLeft />
            </button>
            <button 
              disabled={currentQuestionIndex === questions.length - 1}
              onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
              className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </footer>

        {/* Submit Confirmation Modal */}
        <AnimatePresence>
          {showSubmitConfirm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">Submit Test?</h3>
                  <p className="text-slate-500">Are you sure you want to end the test? You cannot change your answers after submission.</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900">
                      {Object.values(userAnswers).filter(a => (a as UserAnswer).selectedOption !== null).length}
                    </div>
                    <div className="text-xs text-slate-500 uppercase font-bold">Answered</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900">
                      {questions.length - Object.values(userAnswers).filter(a => (a as UserAnswer).selectedOption !== null).length}
                    </div>
                    <div className="text-xs text-slate-500 uppercase font-bold">Remaining</div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowSubmitConfirm(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={submitExam}
                    className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                  >
                    Yes, Submit
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cancel Confirmation Modal */}
        <AnimatePresence>
          {showCancelConfirm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <X size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">Cancel Exam?</h3>
                  <p className="text-slate-500">Are you sure you want to cancel the exam? All progress will be lost and you will return to the home page.</p>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowCancelConfirm(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    No, Continue
                  </button>
                  <button 
                    onClick={cancelExam}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                  >
                    Yes, Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderResult = () => {
    const { correct, wrong, unattempted, score, accuracy } = calculateResults;
    const totalPages = Math.ceil(questions.length / REVIEW_PAGE_SIZE);
    const paginatedQuestions = questions.slice(reviewPage * REVIEW_PAGE_SIZE, (reviewPage + 1) * REVIEW_PAGE_SIZE);

    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-slate-900">Test Performance</h2>
            <button 
              onClick={() => setState('LANDING')}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold"
            >
              <Home size={20} /> Back to Home
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 text-center space-y-2">
              <div className="text-4xl font-bold text-emerald-600">{score}</div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Score</div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 text-center space-y-2">
              <div className="text-4xl font-bold text-slate-900">{accuracy.toFixed(1)}%</div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Accuracy</div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 text-center space-y-2">
              <div className="text-4xl font-bold text-blue-600">{correct}</div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Correct</div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 text-center space-y-2">
              <div className="text-4xl font-bold text-red-500">{wrong}</div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Incorrect</div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Detailed Review</h3>
              <div className="flex gap-2">
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">+4 Correct</span>
                <span className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded">-1 Wrong</span>
              </div>
            </div>
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto custom-scrollbar">
              {paginatedQuestions.map((q, pIdx) => {
                const idx = reviewPage * REVIEW_PAGE_SIZE + pIdx;
                const ans = userAnswers[q.id];
                const isCorrect = ans?.selectedOption === q.correctAnswer;
                const isUnattempted = ans?.selectedOption === null || ans?.selectedOption === undefined;

                return (
                  <div key={q.id} className="p-6 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-400">Q{idx + 1}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isUnattempted ? 'bg-slate-100 text-slate-500' :
                            isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {isUnattempted ? 'Unattempted' : isCorrect ? 'Correct' : 'Incorrect'}
                          </span>
                        </div>
                        <p className="text-slate-800 font-medium">{q.question}</p>
                      </div>
                      <button 
                        onClick={() => toggleSaveQuestion(q.id, q)}
                        className={`p-2 rounded-full transition-colors ${savedQuestionIds.includes(q.id) ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:bg-slate-100'}`}
                      >
                        <Bookmark fill={savedQuestionIds.includes(q.id) ? "currentColor" : "none"} size={20} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {q.options.map((opt, oIdx) => (
                        <div 
                          key={oIdx}
                          className={`p-3 rounded-xl border text-sm flex items-center gap-3 ${
                            oIdx === q.correctAnswer ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold' :
                            oIdx === ans?.selectedOption && !isCorrect ? 'border-red-500 bg-red-50 text-red-700' :
                            'border-slate-100 text-slate-500'
                          }`}
                        >
                          <span className={`w-6 h-6 rounded flex items-center justify-center text-xs ${
                            oIdx === q.correctAnswer ? 'bg-emerald-500 text-white' :
                            oIdx === ans?.selectedOption && !isCorrect ? 'bg-red-500 text-white' :
                            'bg-slate-100 text-slate-400'
                          }`}>
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          {opt}
                        </div>
                      ))}
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl space-y-2">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Explanation</div>
                      <p className="text-sm text-slate-600 leading-relaxed">{q.explanation}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Review Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="text-sm text-slate-500 font-medium">
                  Page {reviewPage + 1} of {totalPages} ({questions.length} total questions)
                </div>
                <div className="flex gap-2">
                  <button 
                    disabled={reviewPage === 0}
                    onClick={() => {
                      setReviewPage(prev => prev - 1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="p-2 bg-white border border-slate-200 text-slate-600 rounded-xl disabled:opacity-50 hover:bg-slate-50 transition-all"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button 
                    disabled={reviewPage === totalPages - 1}
                    onClick={() => {
                      setReviewPage(prev => prev + 1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="p-2 bg-white border border-slate-200 text-slate-600 rounded-xl disabled:opacity-50 hover:bg-slate-50 transition-all"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-center pb-12">
            <button 
              onClick={() => setState('SELECTION')}
              className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-black transition-all flex items-center gap-2"
            >
              <RotateCcw size={20} /> Retake Test
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderGenerating = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center space-y-8"
      >
        <div className="relative w-32 h-32 mx-auto">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-4 border-emerald-100 border-t-emerald-600 rounded-full"
          />
          <div className="absolute inset-0 flex items-center justify-center text-emerald-600">
            <RotateCcw size={40} className="animate-spin-slow" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">Generating Exam</h2>
          <p className="text-slate-500">
            Gemini AI is crafting unique NEET 2026 questions for your selected subjects...
          </p>
        </div>

        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${generationProgress}%` }}
            transition={{ duration: 0.5 }}
            className="bg-emerald-500 h-full"
          />
        </div>
        
        <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">
          This may take up to 30 seconds
        </p>
      </motion.div>
    </div>
  );

  const renderSavedQuestions = () => {
    // We need to handle the case where saved questions might not be in the current AI generated set
    // But since we save the whole object in a real app, here we'll just show a message if they aren't available
    // Actually, let's update the saved questions logic to store the full question object
    const savedQuestions = JSON.parse(localStorage.getItem('neet_saved_questions_full') || '[]');

    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setState('LANDING')} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <ChevronLeft />
              </button>
              <h2 className="text-3xl font-bold text-slate-900">Saved Questions</h2>
            </div>
            <div className="text-slate-500 font-medium">{savedQuestions.length} Questions</div>
          </div>

          {savedQuestions.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center space-y-4 border border-slate-200">
              <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <Bookmark size={40} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">No saved questions yet</h3>
              <p className="text-slate-500">Questions you bookmark during the test will appear here for review.</p>
              <button 
                onClick={() => setState('LANDING')}
                className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
              >
                Go to Home
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {savedQuestions.map((q, idx) => (
                <div key={q.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Question {idx + 1}</span>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            q.subject === 'Biology' ? 'bg-emerald-100 text-emerald-700' :
                            q.subject === 'Chemistry' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {q.subject}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => toggleSaveQuestion(q.id, q)}
                        className="text-amber-500 p-2 hover:bg-amber-50 rounded-full transition-colors"
                      >
                        <Bookmark fill="currentColor" />
                      </button>
                    </div>

                    <p className="text-lg text-slate-800 font-medium">{q.question}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {q.options.map((opt, oIdx) => (
                        <div 
                          key={oIdx}
                          className={`p-3 rounded-xl border text-sm flex items-center gap-3 ${
                            oIdx === q.correctAnswer ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold' : 'border-slate-100 text-slate-500'
                          }`}
                        >
                          <span className={`w-6 h-6 rounded flex items-center justify-center text-xs ${
                            oIdx === q.correctAnswer ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          {opt}
                        </div>
                      ))}
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl space-y-2">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Explanation</div>
                      <p className="text-sm text-slate-600 leading-relaxed">{q.explanation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="font-sans text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
      
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {state === 'LANDING' && renderLanding()}
          {state === 'SELECTION' && renderSelection()}
          {state === 'GENERATING' && renderGenerating()}
          {state === 'EXAM' && renderExam()}
          {state === 'RESULT' && renderResult()}
          {state === 'SAVED_QUESTIONS' && renderSavedQuestions()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
