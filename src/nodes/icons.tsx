/** Material Symbols icon helper — renders a local font icon */
function MS({ name }: { name: string }) {
  return (
    <span className="material-symbols-rounded node-ms-icon">{name}</span>
  );
}

/**
 * Icon string → Material Symbols mapping for all node types.
 * Uses locally installed @material-symbols/font-400 (no CDN).
 */
export const NODE_ICONS: Record<string, React.ReactNode> = {
  // Original 28 nodes
  terminal: <MS name="terminal" />,
  timer: <MS name="timer" />,
  bell: <MS name="notifications" />,
  "clipboard-copy": <MS name="content_paste_go" />,
  "clipboard-paste": <MS name="content_paste" />,
  "file-input": <MS name="file_open" />,
  "file-output": <MS name="upload_file" />,
  copy: <MS name="file_copy" />,
  "file-symlink": <MS name="drive_file_move" />,
  globe: <MS name="public" />,
  "git-branch": <MS name="call_split" />,
  repeat: <MS name="loop" />,
  workflow: <MS name="account_tree" />,
  monitor: <MS name="screenshot_monitor" />,
  scan: <MS name="screenshot_region" />,
  sparkles: <MS name="auto_awesome" />,
  image: <MS name="image" />,
  "text-cursor-input": <MS name="text_fields" />,
  braces: <MS name="data_object" />,
  "bar-chart-3": <MS name="bar_chart" />,
  mail: <MS name="mail" />,
  code: <MS name="code" />,
  apple: <MS name="laptop_mac" />,
  "app-window": <MS name="open_in_new" />,
  keyboard: <MS name="keyboard" />,
  "message-circle": <MS name="chat_bubble" />,
  "folder-search": <MS name="folder_open" />,

  // 14 new nodes
  "message-square": <MS name="sticky_note_2" />,
  variable: <MS name="variable_insert" />,
  database: <MS name="database" />,
  "table-2": <MS name="table_view" />,
  merge: <MS name="merge" />,
  layers: <MS name="stacks" />,
  "image-plus": <MS name="add_photo_alternate" />,
  "volume-2": <MS name="record_voice_over" />,
  mic: <MS name="mic" />,
  brain: <MS name="psychology" />,
  "book-plus": <MS name="library_add" />,
  "book-open": <MS name="menu_book" />,
  webhook: <MS name="webhook" />,

  // New processing nodes
  "filter-list": <MS name="filter_list" />,
  "file-code": <MS name="code_blocks" />,
  "file-search": <MS name="find_in_page" />,

  // Human review & parallel nodes
  "user-check": <MS name="how_to_reg" />,
  "git-fork": <MS name="fork_right" />,
};
