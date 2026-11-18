# My English Vocabulary

영어 단어장 웹앱: 로그인, 클라우드 동기화, 단어 CRUD, 브라우저 발음, 세 가지 테스트, 간격 반복 복습, 오답 복습, 학습 통계.

## 로컬 실행

1. `npm install`
2. `npm run dev`
3. 터미널에 표시되는 주소 접속. `.env`가 없으면 **체험 모드**로 실행되며 브라우저 로컬 저장소에만 기록됩니다.

## 클라우드 동기화 설정

1. [Supabase](https://supabase.com/)에서 새 프로젝트를 생성합니다.
2. SQL Editor에서 `supabase/schema.sql`을 실행합니다. **새 프로젝트에서 한 번만 실행**하세요.
3. Supabase Authentication → Providers에서 Email 인증을 설정합니다. 이메일 확인을 켜면 확인 메일을 받은 뒤 로그인할 수 있습니다.
4. `.env.example`을 `.env`로 복사하고 Project URL 및 **publishable/anon 공개 키**를 입력합니다. `service_role` 또는 secret key는 절대 입력하지 마세요.
5. `npm run dev`로 로그인과 저장을 테스트합니다.

## Vercel 배포

1. 프로젝트를 본인의 GitHub 저장소에 올립니다. `.env`는 올리지 않습니다.
2. [Vercel](https://vercel.com/)에서 해당 저장소를 Import합니다. Framework preset은 Vite입니다.
3. Environment Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 등록합니다.
4. Deploy하면 공개 접속 URL이 발급됩니다.
5. Supabase Authentication → URL Configuration의 Site URL에 Vercel 주소를 설정하고 필요하면 Redirect URLs에 배포 주소를 추가합니다.
6. PC와 휴대폰에서 **같은 이메일 계정**으로 로그인해 동기화를 확인합니다.

## 참고

- 행 수준 보안(RLS)으로 각 사용자 단어와 학습 기록을 분리합니다.
- 음성은 Web Speech API를 사용하므로 발음 종류와 품질이 기기마다 다릅니다.
- 영어→한국어 자동 채점은 저장된 뜻의 `;` 또는 `,`로 구분된 표현과 정확히 일치하는 경우만 정답 처리합니다. 다른 동의어는 '정답 보기' 후 자가 채점하세요.
- 복습 알고리즘은 정답 시 1일→3일→7일 정도로 간격이 늘어나고 오답은 즉시 복습 대상이 됩니다.
- 이 앱은 기초 버전입니다. 여러 기기에서 같은 단어를 동시에 수정할 경우 마지막 서버 저장값이 적용될 수 있습니다.
