# sharehows-data

ShareHows 페이지(101 등)가 읽는 **살아 있는 정보**를 한 시간마다 자동으로 갱신하는 저장소입니다.

- 결과 파일: https://raw.githubusercontent.com/sociallog/sharehows-data/data/live.json
- 갱신: GitHub Actions `refresh-live-data`, 20분마다 예약 (GitHub 예약 실행은 가끔 늦거나 건너뜀), 수동 실행도 가능
- `data` 브랜치는 매번 새로 덮어써서 커밋 1개만 남습니다.

## 들어 있는 정보
| 항목 | 출처 | 키 |
|---|---|---|
| 환율 (1,000원 = 달러·유로·엔·멕시코 페소 등) | Frankfurter (중앙은행 기준환율) | 필요 없음 |
| 서울 지금 날씨 | 기상청 초단기실황 | `DATA_GO_KR_KEY` |
| 서울 미세먼지 평균 | 에어코리아 | `DATA_GO_KR_KEY` |

## 키 넣는 법
공공데이터포털 키는 **Settings → Secrets and variables → Actions → New repository secret** 에 이름 `DATA_GO_KR_KEY` 로 넣습니다.
키는 이 저장소 코드나 결과 파일에 절대 쓰지 않습니다.
