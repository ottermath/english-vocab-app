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
type Mode='en-ko'|'ko-en'|'listen';
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
function App(){const[user,setUser]=useState<User|null>(null);const[authReady,setAuthReady]=useState(!cloud);const[email,setEmail]=useState('');const[message,setMessage]=useState('');const[words,setWords]=useState<Word[]>(()=>cloud?[]:readLocal('vocab-words',[]));const[reviews,setReviews]=useState<Review[]>(()=>cloud?[]:readLocal('vocab-reviews',[]));const[tab,setTab]=useState<'words'|'quiz'|'stats'>('words');const[form,setForm]=useState(empty);const[editing,setEditing]=useState<string|null>(null);const[search,setSearch]=useState('');const[category,setCategory]=useState('전체');const[accent,setAccent]=useState('en-US');const[mode,setMode]=useState<Mode>('en-ko');const[scope,setScope]=useState('due');const[queue,setQueue]=useState<string[]>([]);const[answer,setAnswer]=useState('');const[shown,setShown]=useState(false);const[feedback,setFeedback]=useState<string|null>(null);const[busy,setBusy]=useState(false);const[dictionaryBusy,setDictionaryBusy]=useState(false);const[dictionaryInfo,setDictionaryInfo]=useState<DictionaryResult|null>(null);const[dictionaryError,setDictionaryError]=useState('');
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
function startQuiz(){const selected=(scope==='due'?due:scope==='wrong'?words.filter(w=>w.wrong_count>0):words).filter(w=>category==='전체'||w.category===category);setQueue([...selected].sort(()=>Math.random()-.5).map(w=>w.id));setAnswer('');setShown(false);setFeedback(null)}
const current=words.find(w=>w.id===queue[0]);
async function grade(correct:boolean){if(!current)return;const interval=correct?(current.interval_days===0?1:Math.min(90,Math.ceil(current.interval_days*2.2))):0;const updated={...current,correct_count:current.correct_count+(correct?1:0),wrong_count:current.wrong_count+(correct?0:1),interval_days:interval,due_at:new Date(Date.now()+(correct?interval*86400000:0)).toISOString()};const review:Review={id:crypto.randomUUID(),word_id:current.id,mode,correct,created_at:new Date().toISOString()};if(supabase&&user){const [w,r]=await Promise.all([supabase.from('words').update({correct_count:updated.correct_count,wrong_count:updated.wrong_count,interval_days:interval,due_at:updated.due_at}).eq('id',current.id),supabase.from('reviews').insert({user_id:user.id,word_id:current.id,mode,correct})]);if(w.error||r.error){setMessage(w.error?.message||r.error?.message||'기록 저장 실패');return}}setWords(a=>a.map(w=>w.id===current.id?updated:w));setReviews(a=>[review,...a]);setFeedback(correct?'정답입니다!':'오답으로 기록했습니다.');setShown(true)}
function next(){setQueue(q=>q.slice(1));setAnswer('');setShown(false);setFeedback(null)}
function check(){if(!current)return;const expected=mode==='en-ko'?current.meaning:current.term;const normalize=(s:string)=>s.trim().toLocaleLowerCase().replace(/[.!?]/g,'').replace(/\s+/g,' ');const valid=mode==='en-ko'?expected.split(/[;,，、]/).some(x=>normalize(x)===normalize(answer)):normalize(expected)===normalize(answer);grade(valid)}
if(!authReady)return <main className="shell"><p>로그인 상태 확인 중…</p></main>;
if(cloud&&!user)return <main className="auth"><div className="panel"><h1>📘 My English Vocabulary</h1><p>이 기기에서 처음 사용할 때만 이메일 인증이 필요합니다. 이후에는 자동으로 단어장이 열립니다.</p><label>이메일<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="이메일 주소" /></label><div className="actions"><button disabled={busy||!email.trim()} onClick={sendMagicLink}>이 기기 최초 인증</button></div><p className="muted">{message}</p></div></main>;
return <main className="shell"><header><div><h1><BookOpen size={26}/> My English Vocabulary</h1><p className="muted">매일 조금씩, 오래 기억하는 영어 단어장</p></div><div className="header-actions"><select aria-label="발음 선택" value={accent} onChange={e=>setAccent(e.target.value)}><option value="en-US">🇺🇸 미국식 발음</option><option value="en-GB">🇬🇧 영국식 발음</option></select></div></header>{!cloud&&<div className="notice">로컬 저장 모드: 이 브라우저에만 저장됩니다.</div>}{message&&<div className="notice">{message}<button className="plain" onClick={()=>setMessage('')}>닫기</button></div>}<section className="metrics"><div><strong>{words.length}</strong><span>저장 단어</span></div><div><strong>{due.length}</strong><span>복습 예정</span></div><div><strong>{today.length}</strong><span>오늘 테스트</span></div><div><strong>{accuracy}%</strong><span>전체 정답률</span></div></section><nav><button className={tab==='words'?'active':''} onClick={()=>setTab('words')}><BookOpen size={17}/> 내 단어장</button><button className={tab==='quiz'?'active':''} onClick={()=>{setTab('quiz');setQueue([])}}><CheckCircle2 size={17}/> 테스트</button><button className={tab==='stats'?'active':''} onClick={()=>setTab('stats')}><BarChart3 size={17}/> 학습 통계</button></nav>
{tab==='words'&&<div className="columns"><section className="panel"><h2><Plus size={20}/>{editing?'단어 수정':'단어 추가'}</h2><form onSubmit={saveWord}><label>영어 단어 또는 표현<input required value={form.term} onChange={e=>setForm(f=>({...f,term:e.target.value}))} /></label>{dictionaryBusy&&<p className="muted">사전에서 단어를 찾는 중…</p>}{dictionaryError&&<p className="muted">{dictionaryError}</p>}{dictionaryInfo&&dictionaryInfo.term.toLowerCase()===form.term.trim().toLowerCase()&&<div className="notice"><strong>{form.term.trim()}</strong><p>{dictionaryInfo.ipa||'발음기호 없음'}</p><p>{dictionaryInfo.partOfSpeech&&dictionaryInfo.partOfSpeech+' · '}{dictionaryInfo.definition||'뜻풀이 없음'}</p><p>{dictionaryInfo.example||'사전에서 제공하는 예문이 없습니다.'}</p><button type="button" className="secondary" onClick={()=>playRecorded(dictionaryInfo.audio,form.term,accent)}><Volume2 size={16}/>{dictionaryInfo.audio?'실제 녹음 듣기':'기기 음성으로 듣기'}</button></div>}<label>분류<input value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} /></label><div className="actions"><button disabled={busy||dictionaryBusy||(!dictionaryInfo?.definition||dictionaryInfo.term.toLowerCase()!==form.term.trim().toLowerCase())} type="submit">{editing?'수정 저장':'단어 저장'}</button>{editing&&<button type="button" className="secondary" onClick={()=>{setEditing(null);setForm(empty);setDictionaryInfo(null);setDictionaryError('')}}>취소</button>}</div></form></section><section className="panel"><div className="section-head"><h2>내 단어 목록</h2><span className="muted">{filtered.length}개</span></div><div className="filters"><div className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="단어·뜻·예문 검색"/></div><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></div><div className="word-list">{filtered.length===0?<p className="muted">단어가 없습니다. 첫 단어를 추가해 보세요.</p>:filtered.map(w=><article className="word" key={w.id}><div className="word-top"><div><h3>{w.term}</h3><DictionaryDetails term={w.term} accent={accent}/><p className="muted small">{w.category} · {new Date(w.due_at)<=new Date()?'복습 필요':'복습 예정 '+new Date(w.due_at).toLocaleDateString('ko-KR')}</p></div><div className="icon-actions"><button title="발음 듣기" onClick={()=>{const a=dictionaryCache.get(w.term.toLowerCase())?.audio||'';playRecorded(a,w.term,accent)}}><Volume2 size={20}/></button><button title="수정" onClick={()=>{setEditing(w.id);setForm({term:w.term,meaning:w.meaning,example:w.example,category:w.category});window.scrollTo({top:0,behavior:'smooth'})}}><Pencil size={17}/></button><button title="삭제" onClick={()=>removeWord(w)}><Trash2 size={17}/></button></div></div><p>{w.meaning}</p>{w.example&&<p className="example">{w.example}</p>}</article>)}</div></section></div>}
{tab==='quiz'&&<section className="panel quiz"><h2>단어 테스트</h2><div className="filters"><label>테스트 유형<select value={mode} onChange={e=>{setMode(e.target.value as Mode);setQueue([])}}><option value="en-ko">영어 → 한국어</option><option value="ko-en">한국어 → 영어</option><option value="listen">발음 듣고 철자 쓰기</option></select></label><label>출제 범위<select value={scope} onChange={e=>{setScope(e.target.value);setQueue([])}}><option value="due">오늘 복습할 단어</option><option value="all">전체 단어</option><option value="wrong">틀린 적 있는 단어</option></select></label><label>분류<select value={category} onChange={e=>{setCategory(e.target.value);setQueue([])}}>{categories.map(c=><option key={c}>{c}</option>)}</select></label></div>{queue.length===0?<div className="quiz-start"><p>원하는 유형과 범위를 선택하고 테스트를 시작하세요.</p><button onClick={startQuiz}><RotateCcw size={16}/> 테스트 시작</button></div>:current?<div className="question"><span className="muted">남은 문제 {queue.length}개</span>{mode==='listen'?<button className="listen" onClick={()=>speak(current.term,accent)}><Volume2 size={25}/> 발음 듣기</button>:<h3>{mode==='en-ko'?current.term:current.meaning}</h3>}{mode==='en-ko'&&<button className="secondary" onClick={()=>speak(current.term,accent)}><Volume2 size={17}/> 발음</button>}{!shown?<><input autoFocus placeholder={mode==='en-ko'?'한국어 뜻 입력':'영어 철자 입력'} value={answer} onChange={e=>setAnswer(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')check()}}/><div className="actions"><button onClick={check} disabled={!answer.trim()}>정답 확인</button><button className="secondary" onClick={()=>setShown(true)}>정답 보기 (자가 채점)</button></div></>:<><p className="result">{feedback||'정답을 확인하고 스스로 채점하세요.'}</p><div className="answer"><strong>{current.term}</strong><p>{current.meaning}</p>{current.example&&<em>{current.example}</em>}</div>{feedback?<button onClick={next}>다음 문제 →</button>:<div className="actions"><button onClick={()=>grade(true)}>알고 있었어요</button><button className="secondary" onClick={()=>grade(false)}>몰랐어요</button></div>}</>}</div>:<p>단어를 불러오지 못했습니다.</p>}</section>}
{tab==='stats'&&<section className="panel"><h2>학습 통계</h2><p>누적 테스트 <strong>{reviews.length}회</strong> · 정답 <strong>{reviews.filter(r=>r.correct).length}회</strong> · 오답 <strong>{reviews.filter(r=>!r.correct).length}회</strong></p><h3>최근 테스트 기록</h3>{reviews.length===0?<p className="muted">아직 학습 기록이 없습니다.</p>:<div className="history">{reviews.slice(0,30).map(r=><div key={r.id}><span>{words.find(w=>w.id===r.word_id)?.term||'삭제된 단어'}</span><span className={r.correct?'correct':'incorrect'}>{r.correct?'정답':'오답'}</span><span className="muted small">{new Date(r.created_at).toLocaleString('ko-KR')}</span></div>)}</div>}</section>}
<footer>발음 품질과 사용 가능한 음성은 브라우저 및 기기 환경에 따라 달라질 수 있습니다.</footer></main>}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
