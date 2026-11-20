import React,{useEffect,useMemo,useState} from 'react';
import{createRoot}from'react-dom/client';
import{createClient, type User}from'@supabase/supabase-js';
import{BookOpen,Volume2,Plus,Trash2,Pencil,Search,CheckCircle2,BarChart3,RotateCcw}from'lucide-react';
import './style.css';
const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
const cloud=!!url&&!!key;
const supabase=cloud?createClient(url!,key!):null;
type Word={id:string;user_id?:string;term:string;meaning:string;example:string;category:string;correct_count:number;wrong_count:number;interval_days:number;due_at:string;created_at:string};
type Review={id:string;word_id:string;mode:string;correct:boolean;created_at:string};
type Mode='context'|'listen';
type QuizItem={wordId:string;mode:Mode;options?:string[];correctOption?:number;sentence?:string};
function shuffle<T>(items:T[]):T[]{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function localDateKey(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function dayDiff(date:string){const d=new Date(date),today=new Date();return Math.floor((new Date(today.getFullYear(),today.getMonth(),today.getDate()).getTime()-new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime())/86400000)}
function makeContext(example:string,term:string,definition:string){const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const re=new RegExp(`\\b${escaped}\\b`,'i');if(example&&re.test(example))return example.replace(re,'_____');return `In this sentence, _____ means: ${definition||'the target vocabulary word'}.`}
function readLocal<T>(k:string,fallback:T):T{try{const x=localStorage.getItem(k);return x?JSON.parse(x):fallback}catch{return fallback}}
function speak(term:string,locale:string){if(!('speechSynthesis'in window)){alert('이 브라우저는 음성 재생을 지원하지 않습니다.');return}window.speechSynthesis.cancel();const utter=new SpeechSynthesisUtterance(term);utter.lang=locale;utter.rate=.83;window.speechSynthesis.speak(utter)}
type DictionaryResult={term:string;definition:string;example:string;ipa:string;audio:string;partOfSpeech:string};
const dictionaryCache=new Map<string,DictionaryResult>();
async function lookupDictionary(term:string):Promise<DictionaryResult>{
 const word=term.trim();if(!word)throw new Error('영어 단어를 입력하세요.');
 const cached=dictionaryCache.get(word.toLowerCase());if(cached)return cached;
 const response=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
 if(response.status===404)throw new Error('사전에서 찾지 못했습니다. 직접 입력하여 저장할 수 있습니다.');
 if(!response.ok)throw new Error('사전 연결에 실패했습니다. 잠시 후 다시 시도하세요.');
 const entries=await response.json();if(!Array.isArray(entries)||!entries.length)throw new Error('사전 결과가 없습니다.');
 const phonetics=entries.flatMap((e:any)=>Array.isArray(e.phonetics)?e.phonetics:[]);
 const audioItem=phonetics.find((p:any)=>typeof p.audio==='string'&&p.audio.trim());
 const audioRaw=audioItem?.audio||'';
 const audio=audioRaw.startsWith('//')?'https:'+audioRaw:audioRaw.startsWith('https://')?audioRaw:'';
 const ipa=phonetics.find((p:any)=>p.text)?.text||entries.find((e:any)=>e.phonetic)?.phonetic||'';
 const meanings=entries.flatMap((e:any)=>(e.meanings||[]).flatMap((m:any)=>(m.definitions||[]).map((d:any)=>({definition:d.definition||'',example:d.example||'',partOfSpeech:m.partOfSpeech||''}))));
 const first=meanings.find((m:any)=>m.definition)||{definition:'',example:'',partOfSpeech:''};
 const withExample=meanings.find((m:any)=>m.example);
 const result={term:word,definition:first.definition,example:withExample?.example||'',ipa,audio,partOfSpeech:first.partOfSpeech};
 dictionaryCache.set(word.toLowerCase(),result);return result;
}
function playRecorded(audio:string,term:string,accent:string){
 if(audio){const player=new Audio(audio);player.play().catch(()=>speak(term,accent));}else speak(term,accent);
}
function DictionaryDetails({term,accent}:{term:string;accent:string}){
 const [result,setResult]=useState<DictionaryResult|null>(null);
 useEffect(()=>{let active=true;lookupDictionary(term).then(r=>{if(active)setResult(r)}).catch(()=>{});return()=>{active=false}},[term]);
 if(!result)return null;
 return <div className="muted small" style={{marginTop:6}}>{result.ipa&&<span>발음기호 {result.ipa} </span>}{result.audio&&<button type="button" className="secondary" title="사전 녹음 발음" onClick={()=>playRecorded(result.audio,term,accent)}><Volume2 size={15}/> 녹음 발음</button>}</div>;
}
const empty={term:'',meaning:'',example:'',category:'일반'};
function App(){const[user,setUser]=useState<User|null>(null);const[authReady,setAuthReady]=useState(!cloud);const[email,setEmail]=useState('');const[message,setMessage]=useState('');const[words,setWords]=useState<Word[]>(()=>cloud?[]:readLocal('vocab-words',[]));const[reviews,setReviews]=useState<Review[]>(()=>cloud?[]:readLocal('vocab-reviews',[]));const[tab,setTab]=useState<'words'|'quiz'|'stats'>('words');const[form,setForm]=useState(empty);const[editing,setEditing]=useState<string|null>(null);const[search,setSearch]=useState('');const[category,setCategory]=useState('전체');const[accent,setAccent]=useState('en-US');const[queue,setQueue]=useState<QuizItem[]>([]);const[quizTotal,setQuizTotal]=useState(0);const[quizStarted,setQuizStarted]=useState(false);const[quizScore,setQuizScore]=useState(0);const[answer,setAnswer]=useState('');const[shown,setShown]=useState(false);const[feedback,setFeedback]=useState<string|null>(null);const[busy,setBusy]=useState(false);const[dictionaryBusy,setDictionaryBusy]=useState(false);const[dictionaryInfo,setDictionaryInfo]=useState<DictionaryResult|null>(null);const[dictionaryError,setDictionaryError]=useState('');
useEffect(()=>{if(!supabase)return;supabase.auth.getUser().then(({data})=>{setUser(data.user);setAuthReady(true)});const{data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>setUser(session?.user??null));return()=>subscription.unsubscribe()},[]);
useEffect(()=>{if(!cloud){localStorage.setItem('vocab-words',JSON.stringify(words));localStorage.setItem('vocab-reviews',JSON.stringify(reviews))}},[words,reviews]);
useEffect(()=>{if(!supabase||!user){if(cloud){setWords([]);setReviews([])}return}let active=true;Promise.all([supabase.from('words').select('*').order('created_at',{ascending:false}),supabase.from('reviews').select('*').order('created_at',{ascending:false}).limit(2000)]).then(([w,r])=>{if(!active)return;if(w.error||r.error){setMessage(w.error?.message||r.error?.message||'불러오기 오류');return}setWords(w.data as Word[]);setReviews(r.data as Review[])});return()=>{active=false}},[user]);
const categories=useMemo(()=>['전체',...new Set(words.map(w=>w.category))],[words]);const filtered=words.filter(w=>(category==='전체'||w.category===category)&&`${w.term} ${w.meaning} ${w.example}`.toLowerCase().includes(search.toLowerCase()));const due=words.filter(w=>new Date(w.due_at).getTime()<=Date.now());const today=reviews.filter(r=>new Date(r.created_at).toDateString()===new Date().toDateString());const accuracy=reviews.length?Math.round(reviews.filter(r=>r.correct).length/reviews.length*100):0;
async function sendMagicLink(){if(!supabase||!email.trim())return;setBusy(true);setMessage('');const {error}=await supabase.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:window.location.origin}});setMessage(error?error.message:'인증 이메일을 보냈습니다. 메일의 링크를 눌러 이 기기를 등록하세요.');setBusy(false)}
 // 단어 입력을 멈춘 뒤 자동 조회합니다. 이전 요청의 결과는 무시합니다.
 useEffect(()=>{
  const term=form.term.trim();
  setDictionaryInfo(null);setDictionaryError('');setDictionaryBusy(false);
  if(!term)return;
  let active=true;
  const timer=window.setTimeout(async()=>{
   setDictionaryBusy(true);
   try{
    const result=await lookupDictionary(term);
    if(active)setDictionaryInfo(result);
   }catch(err){
    if(active)setDictionaryError(err instanceof Error?err.message:'사전 조회에 실패했습니다.');
   }finally{if(active)setDictionaryBusy(false)}
  },550);
  return()=>{active=false;window.clearTimeout(timer)};
 },[form.term]);
async function saveWord(e:React.FormEvent){
 e.preventDefault();
 if(!form.term.trim()||!dictionaryInfo||dictionaryInfo.term.toLowerCase()!==form.term.trim().toLowerCase()||dictionaryBusy||busy)return;
 const payload={term:form.term.trim(),meaning:dictionaryInfo.definition,example:dictionaryInfo.example,category:form.category.trim()||'일반'};
 if(!payload.meaning){setMessage('사전에서 뜻풀이를 제공하지 않아 저장할 수 없습니다.');return}
 setBusy(true);setMessage('');let saved=false;
 try{
  if(supabase&&user){
   if(editing){const{data,error}=await supabase.from('words').update(payload).eq('id',editing).select().single();if(error)setMessage(error.message);else{setWords(a=>a.map(w=>w.id===editing?data as Word:w));saved=true}}
   else{const{data,error}=await supabase.from('words').insert({...payload,user_id:user.id}).select().single();if(error)setMessage(error.message);else{setWords(a=>[data as Word,...a]);saved=true}}
  }else if(!cloud){
   if(editing)setWords(a=>a.map(w=>w.id===editing?{...w,...payload}:w));
   else setWords(a=>[{...payload,id:crypto.randomUUID(),correct_count:0,wrong_count:0,interval_days:0,due_at:new Date().toISOString(),created_at:new Date().toISOString()},...a]);
   saved=true;
  }else setMessage('로그인 상태를 확인해 주세요.');
 }catch(err){setMessage(err instanceof Error?err.message:'저장 중 오류가 발생했습니다.')}
 if(saved){setForm(empty);setEditing(null);setDictionaryInfo(null);setDictionaryError('')}
 setBusy(false);
}
async function removeWord(w:Word){if(!confirm(`'${w.term}' 단어를 삭제할까요?`))return;if(supabase){const{error}=await supabase.from('words').delete().eq('id',w.id);if(error){setMessage(error.message);return}}setWords(a=>a.filter(x=>x.id!==w.id));setReviews(a=>a.filter(x=>x.word_id!==w.id))}
 function startQuiz(){
  const todayKey=localDateKey(new Date());
  const recent=words.filter(w=>dayDiff(w.created_at)>=0&&dayDiff(w.created_at)<3);
  const older=words.filter(w=>dayDiff(w.created_at)>=3);
