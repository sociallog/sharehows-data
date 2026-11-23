set -u
mkdir -p /tmp/z && cd /tmp/z
curl -sSL -o codes.zip 'https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003579270&fileDetailSn=1' -A 'Mozilla/5.0'
file codes.zip; unzip -o -q codes.zip || true; find . -type f | head -20
pip -q install openpyxl xlrd==2.0.1 >/dev/null 2>&1
python3 - <<'PY'
import glob,openpyxl,re
want=['배추','양배추','시금치','오이','호박','토마토','무','당근','대파','양파','감자','고구마','사과','배','가지']
for f in glob.glob('**/*.xlsx',recursive=True):
    wb=openpyxl.load_workbook(f,read_only=True)
    for ws in wb.worksheets:
        rows=list(ws.iter_rows(values_only=True))
        print('==',f,ws.title,len(rows)); print(rows[:3])
        for r in rows:
            s=[str(c) for c in r if c is not None]
            if any(x in want for x in s): print(s)
PY
KEY=$(printf %s "$DATA_GO_KR_KEY" | tr -d '[:space:]')
for c in "200 211" "200 223"; do set -- $c
 curl -sS -G 'https://apis.data.go.kr/B552845/perDay/price' --data-urlencode "serviceKey=$KEY" -d pageNo=1 -d numOfRows=5 -d returnType=json --data-urlencode 'cond[exmn_ymd::GTE]=20261120' --data-urlencode 'cond[exmn_ymd::LTE]=20261120' --data-urlencode "cond[ctgry_cd::EQ]=$1" --data-urlencode "cond[item_cd::EQ]=$2" | head -c 1500; echo; done
