# 상상 속 행성까지

지구에서 출발해 영화와 소설 속 일곱 천체를 탐사하고 지구를 다시 바라보는 데스크톱과 모바일에서 체험하는 3D 웹 프로젝트. 목적지별 조작과 항로는 [구현 명세](spec/README.md)에 있다.

## 실행

```sh
npm ci
npm run dev
```

터미널에 표시되는 로컬 URL을 WebGL 2를 지원하는 브라우저에서 연다. 배포용 정적 파일은 `npm run build`로 생성하고 `npm run preview`로 확인할 수 있다.

## 체험

1. 시작 화면에서 소리를 선택한다.
2. 스크롤하거나 하단 버튼을 눌러 같은 3D 공간에서 지구, 달, 태양계를 차례로 본다. 마지막까지 스크롤하면 B612 비행이 시작된다.
3. B612에 도착하면 드래그, 방향키 또는 화면의 버튼으로 소행성 주위를 회전한다. 바오밥 싹을 뽑은 뒤 장미를 찾아 클릭하거나 `장미 관찰`을 누른다.
4. 유리 덮개를 씌우고 기록을 연다. B612 기록에서 가까운 항성계를 보거나 3D 항로에서 다음 천체를 선택한다. 출항 관측에서 스크롤하면 현재 천체에서 멀어지고, 항로 조망의 끝에서 자동 항해가 시작된다.
5. 판도라에서는 빛나는 숲 위의 폴리페무스를 찾는다. 터치 화면에서는 아래로 끌거나 `하늘 보기`를 눌러 시선을 올린다. 아드리안에서는 적외선으로 페트로바 선을 따라 시료를 채취한다. 에리드에서는 세 음으로 교신한다. 아라키스에서는 지름길의 모래 물결이나 그늘길의 마른 집수조를 관측하고, 도착해서 스틸수트에 남은 물을 확인한다. 밀러에서는 파도와 두 시계를 보며 원하는 순간에 출발하고, 타투인의 두 해는 일몰과 궤도에서 바라본다. 완료한 목적지를 다시 찾아갈 수 있고, 아라키스의 두 경로는 한 기록에 누적된다.
6. 일곱 기록을 채우면 마지막 지구 장면과 전체 기록을 연다. 새로고침한 뒤에는 `이어서 탐사`로 마지막 위치를 복원할 수 있다.

## 에셋

- 지구는 NASA GSFC Blue Marble 계열 표면과 구름 지도를 사용한다. 지도 파일은 Three.js 예제의 [표면](https://github.com/mrdoob/three.js/blob/dev/examples/textures/planets/earth_atmos_2048.jpg)과 [구름](https://github.com/mrdoob/three.js/blob/dev/examples/textures/planets/earth_clouds_1024.png) 사본을 사용했다. [NASA Blue Marble](https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/)
- 모바일에서는 지구 표면, 구름, 달의 WebP 경량 사본을 불러온다.
- 달의 표면 지도는 NASA SVS의 CGI Moon Kit다. [NASA SVS](https://svs.gsfc.nasa.gov/4720/)
- 목적지의 지형과 관측 대상은 Three.js에서 생성하며 조종석 프레임은 CSS로 렌더링한다. 천체별 음악과 환경음, 통신·반향·관측 효과음은 Web Audio API로 합성한다.
- B612 OST 후보는 2015년 영화의 「Finding the Rose」다. 수업 시연과 웹 배포에서 사용할 수 있는지 확인 전이므로 구현에는 자체 합성음을 적용했다. [영화 OST 트랙 목록](https://hans-zimmer.com/product/le-petit-prince/)
