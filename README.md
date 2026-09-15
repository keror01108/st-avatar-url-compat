# Avatar URL Compatibility — 1.0.0

SillyTavern용 독립 호환 확장입니다. Theme Manager나 BaiBai Tools의 파일을 수정하지 않습니다.

## 해결하려는 문제

Theme Manager가 기본 채팅 프사를 `/characters/…?tm_avatar_hd=2` 또는 `/User%20Avatars/…?tm_avatar_hd=2`로 바꾼 뒤, 다른 코드가 이 주소를 썸네일로 다시 변환하면 다음처럼 잘못된 요청이 생길 수 있습니다.

```text
/thumbnail?type=avatar&file=<이중 인코딩된 이름>.png%3Ftm_avatar_hd%3D2
```

SillyTavern은 이미지 로딩에 실패하면 `<img>`를 `missing-avatar` 아이콘으로 교체합니다. 이 확장은 실패 뒤 재시도하는 것보다 앞선 단계인 이미지 주소 설정 시점에 개입합니다.

- 채팅의 기본 봇·유저 프사에 한해 자동 원본 고화질 URL 전환을 정상 썸네일 URL로 보정합니다.
- 이미 잘못 만들어진, 위 `tm_avatar_hd` 패턴을 가진 썸네일 주소도 보정합니다.
- 한글, `&`, 공백, `%`, `#`, `?` 등 파일명 문자를 URL 매개변수 안에 보존합니다.
- 같은 썸네일로 돌아오는 중복 대입을 생략해 MutationObserver 반복 갱신을 막습니다.
- 일반 이미지, 외부 이미지 주소, 프리로드용 이미지, 편집된 data/blob 이미지에는 개입하지 않습니다.

**대가:** 기본 채팅 프사는 원본 고화질 이미지 대신 SillyTavern의 썸네일로 표시됩니다. 큰 프사에서는 화질 차이가 보일 수 있습니다. Theme Manager의 테마 관리나 저장된 아바타 바인딩을 삭제하지 않습니다.

## 설치

1. ZIP을 내려받아 압축을 풉니다.
2. **SillyTavern이 실행되는 서버의 확장 폴더**에 `st-avatar-url-compat` 폴더를 넣습니다. 기존 `theme-mgr` 또는 `ST-BaiBai-Tools`와 같은 부모 폴더 아래에 두면 됩니다.
   - 사용자별 설치의 일반적인 예: `SillyTavern/data/default-user/extensions/st-avatar-url-compat/`
   - 사용자가 여러 명이면 `default-user` 대신 해당 사용자의 데이터 폴더를 사용합니다.
3. 최종 구조가 아래와 같은지 확인합니다. 같은 이름의 폴더가 이중으로 중첩되지 않아야 합니다.

```text
extensions/st-avatar-url-compat/manifest.json
extensions/st-avatar-url-compat/index.js
extensions/st-avatar-url-compat/README.md
```

4. SillyTavern 페이지를 새로고침합니다. 확장 목록에 **Avatar URL Compatibility (Theme Manager)**가 나타나면 활성화합니다.
5. **BaiBai Tools와 Theme Manager를 켠 상태**에서 채팅을 열고 렌더링합니다.

이 ZIP은 서버 폴더에 직접 설치하는 패키지입니다. SillyTavern의 Git 저장소 URL 입력란에 ZIP 파일 경로나 이 다운로드 링크를 넣는 방식은 지원하지 않습니다.

기존 테마 CSS와 사용자가 원래 쓰던 CSS 스니펫은 유지합니다. 이 문제 때문에 추가했던 `isolation` 및 프사 z-index 블록은 이 확장의 필수 사항이 아닙니다. 앞서 안내한 Theme Manager 원본 직접 수정은 필요하지 않으며, 이미 수정했다면 원본으로 복원한 상태에서도 사용할 수 있도록 설계했습니다.

## 적용 확인

개발자 도구 Console의 실행 대상을 `top`으로 선택하고 실행합니다.

```js
window.STAvatarURLCompat?.status()
```

- `active: true`: 현재 탭에서 실행 중입니다.
- `corrections`: 잘못되거나 충돌 가능한 주소 대입을 보정한 횟수입니다.
- `suppressedWrites`: 같은 정상 주소로 돌아오는 불필요한 대입을 생략한 횟수입니다.
- `missingAvatars`: 현재 채팅에서 `missing-avatar`로 대체된 프사 수입니다.
- `directSrcHook`, `attributeHook`: 이 확장의 설정 가로채기가 가장 바깥쪽에 있는지 표시합니다. 다른 확장이 나중에 덧씌우면 `false`여도 내부에서 계속 동작할 수 있습니다.

`undefined`라면 확장이 로드되지 않았거나 Console이 iframe을 대상으로 실행 중입니다. 설치 폴더 구조, 활성화 여부, Console의 `top` 선택을 확인합니다.

이 확장은 페이지가 로드될 때마다 자동 실행됩니다. Console에 코드를 매번 붙여넣을 필요가 없습니다. 과거에 제공된 임시 오류 추적·재시도 코드는 알려진 해제 함수가 있으면 정리합니다.

설치 전에 이미 사라진 `<img>`를 추측해서 다시 만들지는 않습니다. 설치 후 전체 페이지를 새로고침해 원래 채팅 데이터로 메시지를 다시 만드세요. 사진 파일 자체가 없거나 서버가 정상 주소의 요청도 거절하는 경우에는 별도 원인 해결이 필요합니다.

## 업데이트와 제거

- 별도 폴더에 설치되므로 Theme Manager나 BaiBai Tools 업데이트가 이 확장의 파일을 덮어쓰지 않습니다.
- 원본 확장들의 동작 방식이 바뀌면 호환 확장도 수정이 필요할 수 있습니다. 모든 미래 버전의 호환성을 보장하는 방식은 아닙니다.
- 제거하려면 SillyTavern에서 이 확장을 비활성화하거나 이 폴더를 제거하고 페이지를 새로고침합니다.
- 현재 탭에서만 일시 중지하려면 `window.STAvatarURLCompat?.stop()`을 실행합니다. 다른 확장이 나중에 덧씌운 함수는 강제로 덮어쓰지 않습니다.
- 채팅 파일, 캐릭터 카드, 아바타 바인딩, 서버 설정을 수정하지 않으며 외부로 데이터를 전송하지 않습니다.

## 검증 범위

Node 자동 테스트와, 공개 Theme Manager v4.5.1의 원본 아바타 모듈을 사용한 격리 테스트를 수행했습니다. 격리 테스트의 DOM과 이미지 프리로드는 테스트 대역이며 실제 브라우저는 아닙니다.

확인한 항목: 봇·유저 주소 보존, 이중 인코딩 보정, 원본 런타임의 반복 reconcile 시 src 중복 변경 방지, 가져온 아바타 바인딩 유지, 변형 없는 원본 아바타 뷰, 비대상 이미지 보존, 제거 시 다른 확장과 공존.

실제 브라우저의 로컬 재현 페이지 접근이 승인 정책으로 거부되어 **실제 브라우저 및 사용자의 설치 환경에서의 검증은 완료하지 못했습니다.** 이번 사용자 로그에서 확인된 URL 패턴에 대응하는 초기 호환 버전입니다.

패키지에 포함한 단위 테스트 실행:

```sh
node --test tests/*.test.cjs
```

검토한 원본:

- https://github.com/wenshui012/theme-mgr/blob/main/index.js
- https://github.com/baibai-git/ST-BaiBai-Tools
- https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/extensions.js

MIT License. 런타임 의존성은 없습니다.
