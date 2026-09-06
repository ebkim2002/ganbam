# 보안 복구 — 승인된 배포

기준 commit: 7bcdcd251a4fd11d11f6a7b32f1f7278ce03955a.

새 정산은 Firebase UID로 소유자를 지정한다. 수정은 UID를 바꾸지 않으며 기존 hostPassword 필드만 삭제한다. 타인의 수정/삭제는 서버 admin claim이 없는 한 거부된다. 공개 Admin 계정은 UID와 이메일 모두 차단한다. 프로필의 isAdmin은 권한 판단에 쓰지 않는다.

모든 로그인 회원의 정산 열람 및 공개 회원가입은 기존 정책대로 유지한다. 승인된 모임 구성원만 열람하도록 제한하는 정책 변경은 포함하지 않는다. 개인별 금액 산식·반올림·이미지 저장·이메일 로직은 유지한다.

## 게시 전 필수 조건

현재 규칙이 만료되어 닫혀 있는 동안 기존 archives를 백업하고 hostPassword 필드를 제거해야 한다. 비밀번호가 남아 있는 상태로 이 규칙을 먼저 게시하면 로그인 회원에게 해당 값이 노출된다. 콘솔에서 관찰한 5개 문서의 UID는 모두 있으며 2개는 문자열 비밀번호, 3개는 null이다. 공유 Admin UID가 소유한 문서는 점검한 5건 중 없다. 게시 직전 목록 재확인이 필요하다.

승인 후 순서: 백업 및 대상 재확인 → hostPassword 필드만 정리(정산/UID 유지) → 공개 계정 비활성화 및 세션 폐기 → 수정 HTML 배포 확인 → Rules 게시 → 실제 사용자 계정으로 합의한 테스트 정산 저장(이메일 발송 OFF). 지정 관리자 claim 부여는 별도 명시적 대상 확인 후 수행하며, 이 후보에는 관리자 계정 생성 코드가 없다.

2026-09-06 사용자가 운영 반영·데이터 정리·계정 조치·Git stage/commit/push를 승인했다. 정산 5건과 기존 규칙을 Windows DPAPI로 암호화 백업하고 복원 일치를 검증했다. hostPassword 필드만 제거했으며 나머지 모든 필드 보존을 검증했다. 노출 공유 계정 비활성화 및 갱신 세션 폐기를 확인했다. HTML 및 규칙 배포, 운영 저장 검증은 후속 단계다. Rules만 먼저 게시하거나 만료일만 연장하지 않는다. 장애 시 임시 fail-closed 규칙으로 닫고 원인을 점검하며 이전 공개 규칙으로 되돌리지 않는다. 비밀번호 제거 후 UI도 이전 비밀번호 방식으로 되돌리지 않는다.

## 검증

Node.js 24, Java 21 기준. npm 및 Java가 PATH에 있어야 한다.

```powershell
npm ci --ignore-scripts
npm run test:app
npm exec -- firebase emulators:exec --only firestore --project demo-ganbam-security "node --test"
git diff --check
git status --short
```

테스트는 127.0.0.1:8087의 demo 프로젝트만 허용하고 운영 연결로 대체하지 않는다. compatibility 테스트는 원본 Git commit이 있는 checkout에서 실행한다. 배포 후보 ZIP만 압축 해제한 경우 tests/app.test.cjs, tests/dom.test.cjs, tests/firestore.rules.test.cjs를 명시하여 실행한다.

Firestore Emulator의 PERMISSION_DENIED 출력은 거부 테스트에서 기대되는 결과다. 개별 assert 및 최종 pass/fail 수치로 판정한다. 실제 이메일 발송·모바일 공유·운영 쓰기는 자동 테스트하지 않는다. 규칙은 상위 필드와 소유권을 검증하며, 임의로 변조한 nested 정산 금액의 수학적 일치까지 서버에서 보증하는 구조는 아니다.
