
import React, { useState, useEffect } from 'react';
import { UserMode, Student, Transaction, Loan } from './types';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { Wallet, ArrowRight, GraduationCap, UserCircle, Lock, X, Heart, RefreshCw } from 'lucide-react';
import { playSuccessSound, playErrorSound, playCoinSound } from './services/audioService';

const STORAGE_KEY = 'calibank_master_db';
const TEACHER_PASSWORD = "perroslocos93";

const App: React.FC = () => {
  const [mode, setMode] = useState<UserMode>(UserMode.NONE);
  const [students, setStudents] = useState<Student[]>([]);
  const [currentUnit, setCurrentUnit] = useState<number>(1);
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // Lógica de Carga y Sincronización por URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const syncData = params.get('sync'); // Datos de sincronización masiva
    const sid = params.get('sid'); // ID de sesión de alumno

    if (syncData) {
      try {
        const decoded = JSON.parse(atob(syncData));
        if (decoded.students) {
          if (window.confirm("Se han detectado datos de sincronización. ¿Deseas sobreescribir tu base de datos local con esta información nueva?")) {
            setStudents(decoded.students);
            setCurrentUnit(decoded.unit || 1);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(decoded));
            playSuccessSound();
          }
        }
      } catch (e) {
        console.error("Error en sincronización por URL", e);
      }
      // Limpiar URL para evitar resincronizaciones accidentales
      window.history.replaceState({}, '', window.location.pathname);
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.students) setStudents(parsed.students);
        if (parsed.unit) setCurrentUnit(parsed.unit);
      } catch (e) {
        console.error("Error loading local storage", e);
      }
    }
    
    if (sid) {
      setCurrentStudentId(sid);
      setMode(UserMode.STUDENT);
      if (!syncData) window.history.replaceState({}, '', window.location.pathname);
    }
    
    setIsDataLoaded(true);
  }, []);

  // Guardado Automático
  useEffect(() => {
    if (isDataLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ students, unit: currentUnit }));
    }
  }, [students, currentUnit, isDataLoaded]);

  const addStudent = (name: string) => {
    const newStudent: Student = {
      id: `std_${Math.random().toString(36).substr(2, 6)}`,
      name: name.toUpperCase(),
      balance: 100,
      transactions: [{
        id: `tx_${Date.now()}`,
        type: 'CREDIT',
        amount: 100,
        concept: 'Bono Apertura Cali-Bank',
        timestamp: Date.now()
      }],
      qrCode: '',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}${Date.now()}`
    };
    setStudents(prev => [...prev, newStudent]);
    playSuccessSound();
  };

  const deleteStudent = (id: string) => {
    if (window.confirm("¿ELIMINAR ALUMNO? Esta acción solo afecta a este dispositivo.")) {
      setStudents(prev => prev.filter(s => s.id !== id));
      playErrorSound();
    }
  };

  const updateBalance = (studentId: string, amount: number, concept: string, type: 'CREDIT' | 'DEBIT') => {
    let unitAdvanced = false;
    let nextUnit = currentUnit;

    setStudents(prev => {
      return prev.map(s => {
        if (s.id === studentId) {
          const newTx: Transaction = {
            id: `tx_${Date.now()}`,
            type,
            amount,
            concept: concept.toUpperCase(),
            timestamp: Date.now()
          };
          const newBalance = type === 'CREDIT' ? s.balance + amount : s.balance - amount;
          
          let loanStatus = s.activeLoan;
          let finalTransactions = [newTx, ...s.transactions];

          if (loanStatus?.isActive && newBalance >= loanStatus.targetGoal) {
            loanStatus = { ...loanStatus, isActive: false };
            const paidTx: Transaction = {
              id: `tx_paid_${Date.now()}`,
              type: 'CREDIT',
              amount: 0,
              concept: `CRÉDITO SALDADO (META ${loanStatus.targetGoal} ALCANZADA)`,
              timestamp: Date.now()
            };
            finalTransactions = [paidTx, ...finalTransactions];
          }

          if (newBalance >= 1000 && currentUnit < 2) { unitAdvanced = true; nextUnit = 2; }
          if (newBalance >= 2000 && currentUnit < 3) { unitAdvanced = true; nextUnit = 3; }

          return {
            ...s,
            balance: Math.max(0, newBalance),
            transactions: finalTransactions,
            activeLoan: loanStatus
          };
        }
        return s;
      });
    });

    if (unitAdvanced) {
      setCurrentUnit(nextUnit);
      playSuccessSound();
      alert(`¡UNIDAD COMPLETADA! Cali-Bank subió a Nivel ${nextUnit}.`);
    }
  };

  const requestLoan = (studentId: string, amount: number = 500) => {
    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        if (s.activeLoan?.isActive) return s;
        const targetGoal = currentUnit * 1000;
        const loanTx: Transaction = {
          id: `tx_loan_${Date.now()}`,
          type: 'CREDIT',
          amount,
          concept: `CRÉDITO U${currentUnit} (META: ${targetGoal} Ȼ)`,
          timestamp: Date.now()
        };
        return {
          ...s,
          balance: s.balance + amount,
          transactions: [loanTx, ...s.transactions],
          activeLoan: { amount, timestamp: Date.now(), targetGoal, isActive: true }
        };
      }
      return s;
    }));
    playCoinSound();
  };

  const processEndOfUnit = () => {
    if (!window.confirm(`¿Finalizar Unidad ${currentUnit}? Se cobrarán intereses a préstamos no pagados.`)) return;
    setStudents(prev => prev.map(s => {
      if (s.activeLoan?.isActive) {
        if (s.balance < s.activeLoan.targetGoal) {
          const debtTx: Transaction = {
            id: `tx_debt_${Date.now()}`,
            type: 'DEBIT',
            amount: 1000,
            concept: `INTERÉS MORATORIO U${currentUnit}`,
            timestamp: Date.now()
          };
          return {
            ...s,
            balance: Math.max(0, s.balance - 1000),
            transactions: [debtTx, ...s.transactions],
            activeLoan: { ...s.activeLoan, isActive: false }
          };
        }
        return { ...s, activeLoan: { ...s.activeLoan, isActive: false } };
      }
      return s;
    }));
    if (currentUnit < 3) setCurrentUnit(prev => prev + 1);
    playSuccessSound();
  };

  const registerAttendance = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const now = new Date();
    const last = student.lastAttendance ? new Date(student.lastAttendance) : null;
    const isSameDay = last && now.toDateString() === last.toDateString();

    if (isSameDay) {
      alert("Asistencia ya registrada hoy.");
      return;
    }

    // PUNTO DE ASISTENCIA FIJADO EN 1
    updateBalance(studentId, 1, `ASISTENCIA ${now.toLocaleDateString()}`, 'CREDIT');
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, lastAttendance: Date.now() } : s));
  };

  // --- SINCRONIZACIÓN MAESTRA ---
  const generateSyncLink = () => {
    const data = btoa(JSON.stringify({ students, unit: currentUnit }));
    const url = `${window.location.origin}${window.location.pathname}?sync=${data}`;
    navigator.clipboard.writeText(url).then(() => {
      alert("¡Enlace de Sincronización Copiado! Ábrelo en tu otro dispositivo para clonar los datos.");
      playSuccessSound();
    });
  };

  const copyRawDb = () => {
    const data = JSON.stringify({ students, unit: currentUnit });
    navigator.clipboard.writeText(data).then(() => {
      alert("Código de base de datos copiado.");
      playSuccessSound();
    });
  };

  const importRawDb = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      if (parsed.students) {
        setStudents(parsed.students);
        setCurrentUnit(parsed.unit || 1);
        alert("Sincronización Exitosa.");
        playSuccessSound();
        return true;
      }
    } catch (e) {
      alert("Error en el formato de datos.");
    }
    return false;
  };

  const handleTeacherAccess = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passwordInput === TEACHER_PASSWORD) {
      setMode(UserMode.TEACHER);
      setShowPasswordModal(false);
      setPasswordInput('');
      playSuccessSound();
    } else {
      playErrorSound();
      alert("Clave incorrecta.");
    }
  };

  const Footer = () => (
    <footer className="mt-auto py-8 text-center border-t border-white/5 bg-slate-900/40 backdrop-blur-md">
      <div className="flex flex-col items-center gap-2">
        <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.3em] bg-indigo-500/5 px-4 py-2 rounded-full border border-indigo-500/10">
          Teacher: Ricardo Espino Gonzalez
        </span>
        <span className="text-slate-600 text-[8px] uppercase tracking-widest font-bold">
          CALI-BANK SECURE STORAGE <Heart size={8} className="text-rose-600 inline ml-1" />
        </span>
      </div>
    </footer>
  );

  if (mode === UserMode.NONE) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.08),transparent_50%)]"></div>
        <div className="text-center mb-10 relative z-10 mt-auto animate-in zoom-in duration-500">
          <div className="bg-amber-500/10 p-5 rounded-[2.5rem] inline-block mb-6 border border-amber-500/20 shadow-2xl">
            <Wallet size={56} className="text-amber-500" />
          </div>
          <h1 className="text-6xl font-black mb-2 tracking-tighter bg-gradient-to-b from-white to-slate-500 bg-clip-text text-transparent uppercase">CALI-BANK</h1>
          <p className="text-slate-500 text-lg font-medium px-4">Tu monedero escolar sincronizado.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl relative z-10">
          <button onClick={() => setShowPasswordModal(true)} className="group bg-slate-900/50 border border-white/5 p-8 rounded-[2.5rem] hover:bg-indigo-600 transition-all text-left shadow-xl hover:scale-[1.02]">
            <GraduationCap size={32} className="mb-4 text-indigo-400 group-hover:text-white" />
            <h2 className="text-2xl font-bold mb-1">Docente</h2>
            <p className="text-slate-500 text-[10px] uppercase tracking-widest group-hover:text-indigo-200">Panel de Control</p>
          </button>
          <button onClick={() => { setMode(UserMode.STUDENT); playSuccessSound(); }} className="group bg-slate-900/50 border border-white/5 p-8 rounded-[2.5rem] hover:bg-amber-600 transition-all text-left shadow-xl hover:scale-[1.02]">
            <UserCircle size={32} className="mb-4 text-amber-500 group-hover:text-white" />
            <h2 className="text-2xl font-bold mb-1">Alumno</h2>
            <p className="text-slate-500 text-[10px] uppercase tracking-widest group-hover:text-amber-100">Consultar Saldo</p>
          </button>
        </div>

        {showPasswordModal && (
          <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-6">
            <div className="bg-slate-900 border border-white/10 p-10 rounded-[3rem] w-full max-w-sm shadow-2xl text-center">
              <button onClick={() => setShowPasswordModal(false)} className="absolute top-8 right-8 text-slate-500"><X size={24} /></button>
              <Lock size={32} className="text-indigo-400 mb-6 mx-auto" />
              <h3 className="text-xl font-black mb-6 uppercase">Acceso Maestro</h3>
              <form onSubmit={handleTeacherAccess} className="space-y-4">
                <input autoFocus type="password" placeholder="CLAVE" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-center font-bold outline-none focus:border-indigo-500" />
                <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-lg">Entrar</button>
              </form>
            </div>
          </div>
        )}
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <nav className="border-b border-white/5 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setMode(UserMode.NONE)}>
            <div className="bg-amber-500 p-1.5 rounded-lg shadow-lg"><Wallet size={18} className="text-slate-950" /></div>
            <span className="font-black text-xl tracking-tighter uppercase">CALI-BANK</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600/20 text-indigo-400 px-3 py-1.5 rounded-full border border-indigo-400/20 font-black text-[9px] uppercase tracking-widest">
              U{currentUnit}
            </div>
            <button onClick={() => { setMode(UserMode.NONE); setCurrentStudentId(null); }} className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-rose-600 transition-colors text-[9px] font-black uppercase tracking-widest">SALIR</button>
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto p-4 md:p-8 flex-1 w-full">
        {mode === UserMode.TEACHER ? (
          <TeacherDashboard 
            students={students} 
            currentUnit={currentUnit}
            addStudent={addStudent} 
            deleteStudent={deleteStudent} 
            updateBalance={updateBalance} 
            requestLoan={requestLoan}
            processEndOfUnit={processEndOfUnit}
            generateSyncLink={generateSyncLink}
            copyRawDb={copyRawDb}
            importRawDb={importRawDb}
            setAllStudents={(s) => setStudents(s)} 
          />
        ) : (
          <StudentDashboard 
            students={students} 
            currentUnit={currentUnit}
            currentStudentId={currentStudentId} 
            setCurrentStudentId={setCurrentStudentId} 
            registerAttendance={registerAttendance} 
            requestLoan={requestLoan} 
          />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default App;
