// Claude Code 훅 공용: stdin JSON 에서 tool_input 의 필드 하나를 출력한다. 사용: node read-input.cjs file_path [notebook_path ...]
// jq 의존을 없앤다(2026-10-29: WSL 개발 환경에 jq 가 없음). 파싱 실패는 빈 출력.
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw || '{}').tool_input || {};
    for (const key of process.argv.slice(2)) {
      if (typeof input[key] === 'string' && input[key]) {
        process.stdout.write(input[key]);
        return;
      }
    }
  } catch {}
});
