# 상상 속 행성까지

지구에서 소행성 B612까지 스크롤과 자동 비행으로 이동하는 데스크톱 3D 웹 프로젝트. 첫 구현은 [지구 인트로](spec/stages/earth.md)와 [B612](spec/stages/b612.md)의 화면과 조작을 검토하기 위한 버전이다. 전체 여정은 [구현 명세](spec/README.md)에 있다.

## 실행

```sh
npm ci
npm run dev
```

터미널에 표시되는 로컬 URL을 WebGL 2를 지원하는 데스크톱 브라우저에서 연다. 배포용 정적 파일은 `npm run build`로 생성하고 `npm run preview`로 확인할 수 있다.

## 체험

1. 시작 화면에서 소리를 선택한다.
2. 스크롤하거나 하단 버튼을 눌러 같은 3D 공간에서 지구, 달, 태양계를 차례로 본다. 마지막까지 스크롤하면 B612 비행이 시작된다.
3. B612에 도착하면 드래그, 방향키 또는 화면의 버튼으로 소행성 주위를 회전한다. 장미가 보이면 클릭하거나 `장미 관찰`을 누른다.
4. 유리 덮개를 씌우고 기록을 연다. 기록에서 가까운 항성계를 볼 수 있다. 탐사 도중 새로고침하면 시작 화면의 `이어서 탐사`로 복원할 수 있다.

## 에셋

- 지구는 NASA GSFC Blue Marble 계열 표면과 구름 지도를 사용한다. 지도 파일은 Three.js 예제의 [표면](https://github.com/mrdoob/three.js/blob/dev/examples/textures/planets/earth_atmos_2048.jpg)과 [구름](https://github.com/mrdoob/three.js/blob/dev/examples/textures/planets/earth_clouds_1024.png) 사본을 사용했다. [NASA Blue Marble](https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/)
- 달의 표면 지도는 NASA SVS의 CGI Moon Kit다. [NASA SVS](https://svs.gsfc.nasa.gov/4720/)
- B612 지형, 장미, 덮개는 Three.js에서 생성하며 조종석 프레임은 CSS로 렌더링한다. 소리는 Web Audio API로 합성한다.
- B612 OST 후보는 2015년 영화의 「Finding the Rose」다. 수업 시연과 웹 배포에서 사용할 수 있는지 확인 전이므로 구현에는 자체 합성음을 적용했다. [영화 OST 트랙 목록](https://hans-zimmer.com/product/le-petit-prince/)
