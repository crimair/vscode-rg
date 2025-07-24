// VSCode WebView クライアントスクリプト (TypeScript移植)
import { highlightMatch } from './highlightMatch';

declare function acquireVsCodeApi(): {
  postMessage: (msg: any) => void;
};

interface SearchHit {
  file: string;
  line: number;
  col: number;
  text: string;
}
type SearchResult = {
  file: string;
  items: SearchHit[];
};

window.addEventListener('DOMContentLoaded', () => {
    // スタイルはextension.ts側で付与するため、ここでの<style>挿入は不要

    const vscode = acquireVsCodeApi();
    const input = document.querySelector<HTMLInputElement>('.search-input')!;
    // 初期検索ワードをセット
    // @ts-ignore
    input.value = (window as any).initialQuery || '';
    const resultList = document.querySelector<HTMLDivElement>('.result-list')!;
    // ディレクトリパス表示行を取得
    const dirRow = document.getElementById('search-dir-row');
    // ナビ用divを作成し右側に配置
    const navDiv = document.createElement('span');
    navDiv.id = 'page-nav';
    navDiv.className = 'page-nav';
    if (dirRow) dirRow.appendChild(navDiv);

    let results: SearchResult[] = [];
    let flatHits: SearchHit[] = [];
    let selectedIdx = 0;
    let currentPage = 0;
    const PAGE_SIZE = 50;

    // --- 検索ID管理 ---
    let searchSeq = 0;
    let currentSearchId = 0;

    // Set focus and trigger initial search if query exists
    setTimeout(() => {
      input.focus();
      if (input.value) {
        triggerSearch();
      }
    }, 10);

  // フォーカスが外れたら自動で戻す
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.activeElement !== input) {
        input.focus();
      }
    }, 10);
  });

  // 検索ワードに大文字が含まれていればcase sensitive、なければignoreCase
  function triggerSearch() {
    const query = input.value;
    // 英字大文字を含むか判定
    const hasUpper = /[A-Z]/.test(query);
    searchSeq += 1;
    currentSearchId = searchSeq;
    vscode.postMessage({
      type: 'search',
      id: currentSearchId,
      query: query,
      options: {
        case: hasUpper ? true : false
      }
    });
  }

  input.addEventListener('input', triggerSearch);

  window.addEventListener('message', event => {
    const msg = event.data;
    console.log('[VSAGLOG][WebView] message received:', msg);

    // --- 検索ID付きメッセージ対応 ---
    if (msg.type === 'clearResults') {
      if (msg.id === currentSearchId) {
        results = [];
        flatHits = [];
        selectedIdx = 0;
        currentPage = 0;
        resultList.innerHTML = '';
        renderResults();
      }
    } else if (msg.type === 'appendResult') {
      if (msg.id === currentSearchId && msg.data) {
        // 1行分のデータを既存整形ロジックでパースしてflatHitsに追加
        const line = msg.data;
        const m = line.match(/^(.*?):(\d+):(\d+):(.*)$/);
        if (m) {
          flatHits.push({
            file: m[1],
            line: Number(m[2]),
            col: Number(m[3]),
            text: m[4]
          });
        }
        if (!(window as any).__renderScheduled) {
          (window as any).__renderScheduled = true;
          setTimeout(() => {
            renderResults();
            (window as any).__renderScheduled = false;
          }, 0);
        }
      }
    } else if (msg.type === 'selectUp') {
      if (flatHits.length > 0) {
        if (selectedIdx === 0 && currentPage > 0) {
          currentPage--;
          selectedIdx = PAGE_SIZE - 1;
          renderResults();
        } else {
          selectedIdx = (selectedIdx - 1 + PAGE_SIZE) % PAGE_SIZE;
          renderResults();
        }
      }
    } else if (msg.type === 'selectDown') {
      if (flatHits.length > 0) {
        const totalPages = Math.ceil(flatHits.length / PAGE_SIZE);
        const startIdx = currentPage * PAGE_SIZE;
        const endIdx = Math.min(startIdx + PAGE_SIZE, flatHits.length);
        const pageHits = flatHits.slice(startIdx, endIdx);
        if (selectedIdx === pageHits.length - 1 && currentPage < totalPages - 1) {
          currentPage++;
          selectedIdx = 0;
          renderResults();
        } else {
          selectedIdx = (selectedIdx + 1) % pageHits.length;
          renderResults();
        }
      }
    } else if (msg.type === 'pageUp') {
      if (flatHits.length > 0) {
        const totalPages = Math.ceil(flatHits.length / PAGE_SIZE);
        const startIdx = currentPage * PAGE_SIZE;
        let newIdx = selectedIdx - 10;
        if (newIdx < 0) {
          if (currentPage > 0) {
            currentPage--;
            const prevPageHits = flatHits.slice((currentPage) * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
            selectedIdx = Math.max(prevPageHits.length + newIdx, 0);
          } else {
            selectedIdx = 0;
          }
        } else {
          selectedIdx = newIdx;
        }
        renderResults();
      }
    } else if (msg.type === 'pageDown') {
      if (flatHits.length > 0) {
        const totalPages = Math.ceil(flatHits.length / PAGE_SIZE);
        const startIdx = currentPage * PAGE_SIZE;
        const endIdx = Math.min(startIdx + PAGE_SIZE, flatHits.length);
        const pageHits = flatHits.slice(startIdx, endIdx);
        let newIdx = selectedIdx + 10;
        if (newIdx >= pageHits.length) {
          if (currentPage < totalPages - 1) {
            currentPage++;
            const nextPageHits = flatHits.slice(currentPage * PAGE_SIZE, Math.min((currentPage + 1) * PAGE_SIZE, flatHits.length));
            selectedIdx = Math.min(newIdx - pageHits.length, nextPageHits.length - 1);
          } else {
            selectedIdx = pageHits.length - 1;
          }
        } else {
          selectedIdx = newIdx;
        }
        renderResults();
      }
    } else if (msg.type === 'left') {
      if (currentPage > 0) {
        currentPage--;
        selectedIdx = 0;
        renderResults();
      }
    } else if (msg.type === 'right') {
      const totalPages = Math.ceil(flatHits.length / PAGE_SIZE);
      if (currentPage < totalPages - 1) {
        currentPage++;
        selectedIdx = 0;
        renderResults();
      }
    } else if (msg.type === 'jumpToSelected') {
      jumpToSelected();
    } else if (msg.type === 'close') {
      // ここでWebView自身を閉じる処理は不要（VSCode拡張がdisposeする）
      // 無限ループ防止のため何もしない
      // 必要ならUIを非表示にするなどの処理を追加可能
      // window.close(); // 通常は不要
    }
  });

  function renderResults() {
    console.log('[VSAGLOG][WebView] renderResults flatHits.length:', flatHits.length, flatHits);
    resultList.innerHTML = '';

    // ページング
    const totalPages = Math.ceil(flatHits.length / PAGE_SIZE);
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    if (currentPage < 0) currentPage = 0;
    const startIdx = currentPage * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, flatHits.length);
    const pageHits = flatHits.slice(startIdx, endIdx);

    // ページ切り替えボタン＋ページ情報（ディレクトリパス右側に表示）
    if (navDiv) {
      navDiv.innerHTML = '';
      if (flatHits.length > 0) {
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '<';
        prevBtn.disabled = currentPage === 0;
        prevBtn.onclick = () => {
          currentPage--;
          selectedIdx = 0;
          renderResults();
        };

        const pageInfo = document.createElement('span');
        // n/N形式で表示（全体の何件目か）
        const globalIdx = currentPage * PAGE_SIZE + selectedIdx + 1;
        pageInfo.textContent = ` ${globalIdx} / ${flatHits.length} `;

        const nextBtn = document.createElement('button');
        nextBtn.textContent = '>';
        nextBtn.disabled = currentPage >= totalPages - 1;
        nextBtn.onclick = () => {
          currentPage++;
          selectedIdx = 0;
          renderResults();
        };

        navDiv.appendChild(prevBtn);
        navDiv.appendChild(pageInfo);
        navDiv.appendChild(nextBtn);
      }
    }

    if (flatHits.length === 0) {
      resultList.innerHTML = '<div class="result-item selected">（N/A）</div>';
      if (navDiv) navDiv.innerHTML = '';
      return;
    }

    pageHits.forEach((hit, i) => {
      const div = document.createElement('div');
      div.className = 'result-item' + (i === selectedIdx ? ' selected' : '');
      div.dataset.index = i.toString();
      div.textContent = '';

      const fileSpan = document.createElement('span');
      fileSpan.className = 'result-file';
      fileSpan.innerHTML = '<span style="font-weight:bold;color:#4FC3F7;">' + hit.file + '</span>';

      const lineSpan = document.createElement('span');
      lineSpan.className = 'result-line';
      lineSpan.innerHTML = '<span style="font-weight:bold;color:#FFD54F;">:' + hit.line + '</span>';

      const textSpan = document.createElement('span');
      textSpan.className = 'result-text';
      const highlighted = highlightMatch(hit.text, input.value);
      console.log('[VSAGLOG][highlightMatch]', { text: hit.text, query: input.value, highlighted });
      textSpan.innerHTML = ': ' + highlighted;

      div.appendChild(fileSpan);
      div.appendChild(lineSpan);
      div.appendChild(textSpan);
      resultList.appendChild(div);

      if (i === selectedIdx) {
        div.scrollIntoView({ block: 'nearest' });
      }

      div.addEventListener('click', () => {
        selectedIdx = i;
        jumpToSelected();
      });
    });
  }


  function jumpToSelected() {
    const startIdx = currentPage * PAGE_SIZE;
    const pageHits = flatHits.slice(startIdx, Math.min(startIdx + PAGE_SIZE, flatHits.length));
    if (pageHits[selectedIdx]) {
      vscode.postMessage({
        type: 'jump',
        file: pageHits[selectedIdx].file,
        line: pageHits[selectedIdx].line
      });
    }
  }

  // VSCodeキーバインド経由でのみリスト操作を行うため、keydownイベントから該当処理を削除

  // フォント情報のデバッグ出力
  const cssVar = getComputedStyle(document.body).getPropertyValue('--vscode-editor-font-family');
  const bodyFont = getComputedStyle(document.body).fontFamily;
  const resultItem = document.querySelector('.result-item');
  const resultFont = resultItem ? getComputedStyle(resultItem).fontFamily : '(not found)';
  const logDiv = document.getElementById('font-log');
  const logText =
    '[WebView] --vscode-editor-font-family: ' + cssVar + '\n' +
    '[WebView] body font-family: ' + bodyFont + '\n' +
    '[WebView] .result-item font-family: ' + resultFont;
  if (logDiv) logDiv.innerText = logText;
  console.log(logText);

  // ハイライト用CSSは全体CSSに統合したため、ここは削除

  // Escapeキー押下時にWebviewを閉じるメッセージを送信
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      vscode.postMessage({ type: 'close' });
      e.preventDefault();
    }
  });
});