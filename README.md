# 골라골라 (웹 배포판)

여러 사람이 **URL 하나**로 접속하는 음료 취합 앱입니다. 화면은 GitHub Pages, 데이터·로그인·권한은 Supabase가 맡습니다. (내 PC를 켜 둘 필요가 없습니다.)

```
슈퍼관리자(나) ─ 프로젝트 관리, 관리자 요청 승인/회수, 관리자별 프로젝트 배정
관리자         ─ 배정된 프로젝트 안에서 업무(주문) 생성·마감·취합 종료(데이터 삭제)
참여자         ─ 로그인 없이 링크로 들어와 이름 입력 후 "선택"
```

## 1. Supabase 설정 (약 10분)

1. https://supabase.com 에서 새 프로젝트를 만든다.
2. **Authentication → Providers → Email** 에서 **"Confirm email" 을 끈다.**
   (켜 두면 관리자 요청 직후 확인 메일을 눌러야 해서 흐름이 막힌다. 승인은 슈퍼관리자가 하므로 메일 확인은 필요 없다.)
3. **SQL Editor** 에 `supabase/schema.sql` 전체를 붙여넣고 **Run**.
4. **Edge Functions → Deploy a new function → Via Editor** 에서 이름을 `franchise` 로 하고
   `supabase/functions/franchise/index.ts` 내용을 붙여넣어 Deploy. (프랜차이즈 메뉴 실시간 조회용. JWT 검증은 기본값(켜짐) 그대로 둔다.)
5. **Project Settings → API** 의 `Project URL` 과 `anon public` 키를 `config.js` 에 넣는다.
   (`service_role` 키는 절대 넣지 말 것.)

## 2. GitHub Pages 배포

```powershell
cd drink-order-web
git init -b main
git add .
git commit -m "골라골라 웹 배포판"
git remote add origin https://github.com/<계정>/<저장소>.git
git push -u origin main
```

저장소 **Settings → Pages → Branch: main / (root)** 로 켜면 `https://<계정>.github.io/<저장소>/` 로 접속된다.
이 주소가 팀원들에게 공유할 URL이다.

## 3. 최초 슈퍼관리자 지정

1. 배포된 사이트의 `관리자 로그인 / 권한 요청` 에서 내 이메일로 **관리자 권한 요청**(가입).
2. Supabase **SQL Editor** 에서 한 번만 실행:
   ```sql
   update public.profiles set role = 'super', status = 'approved' where email = '내이메일@회사.com';
   ```
3. 이제 같은 이메일로 로그인하면 `슈퍼관리자 콘솔` 이 보인다. 이후 관리자 승인과 프로젝트 배정은 모두 화면에서 한다.

## 사용 흐름

1. 슈퍼관리자: 프로젝트 만들기 → 관리자 요청 승인 → 프로젝트에 관리자 배정
2. 관리자: `업무 관리` → 프로젝트 선택 → 새 업무(프랜차이즈 메뉴 가져오기 또는 메뉴판 이미지) → 링크를 팀원에게 공유
3. 참여자: 링크에서 이름 입력 후 "선택" / 관리자: 메뉴별 선택 현황 확인, 주문 마감
4. 끝나면 **취합 종료** → 그 업무의 메뉴·선택 내역 삭제 (프로젝트·관리자 정보는 유지)

## 알아둘 점

- Supabase 무료 플랜은 **일정 기간(약 1주) 접속이 없으면 프로젝트가 일시 중지**된다. 대시보드에서 Restore 하면 된다.
- 프랜차이즈 메뉴는 Edge Function(해외 클라우드 IP)이 공식 사이트에서 가져온다. 사이트가 해당 IP를 막거나 구조가 바뀌면 자동으로 기본 목록으로 대체되고 화면에 안내가 뜬다.
- 참여자는 로그인 없이 이름만 입력하므로, 같은 업무 안에서 다른 사람 이름으로도 선택할 수 있다(사내 신뢰 기반 서비스 전제).
- 사내 정책상 외부 클라우드(GitHub/Supabase)에 인원 이름·이메일을 저장해도 되는지 먼저 확인할 것.
- 기존 로컬 서버판(`drink-order` 폴더)과는 데이터가 공유되지 않는다.
