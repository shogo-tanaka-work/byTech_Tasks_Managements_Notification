const MAX_CONTENT_LENGTH = 1800;

export function createNotificationFormatter() {
  function buildThreadMessage(snapshot) {
    const header = buildHeader(snapshot);
    const embeds = [buildSummaryEmbed(snapshot)];
    
    if (snapshot.invalidChildren?.length) {
      embeds.push(buildInvalidEmbed(snapshot.invalidChildren));
    }

    return {
      content: header,
      embeds
    };
  }

  return {
    buildThreadMessage
  };
}

function buildHeader(snapshot) {
  const { projectId, timestamp, completion } = snapshot;
  let header = `**${projectId}** — ${completion.percentage}% 完了 (${completion.done}/${completion.total})\n`;
  header += `最終同期: ${timestamp}`;
  if (snapshot.invalidChildren?.length) {
    header += `\n警告: ${snapshot.invalidChildren.length} 件のタスクに欠落項目があります。`;
  }
  return header.slice(0, MAX_CONTENT_LENGTH);
}

function buildSummaryEmbed(snapshot) {
  const fields = [];
  fields.push({ name: '総タスク', value: `${snapshot.completion.total}`, inline: true });
  fields.push({ name: '完了', value: `${snapshot.completion.done}`, inline: true });
  fields.push({ name: '未完了', value: `${snapshot.completion.total - snapshot.completion.done}`, inline: true });

  const taskLines = snapshot.children.map((child) => formatTaskLine(child)).join('\n');

  return {
    title: 'タスク一覧',
    description: taskLines.slice(0, MAX_CONTENT_LENGTH),
    fields
  };
}

function buildInvalidEmbed(invalidChildren) {
  const content = invalidChildren.map((item) => `- ${item.taskId || '不明'}: ${item.reason}`).join('\n');
  return {
    title: '入力不備タスク',
    description: content.slice(0, MAX_CONTENT_LENGTH)
  };
}

function formatTaskLine(child) {
  const markers = (child.markers || []).map((marker) => markerLabel(marker)).join(' ');
  const dueText = child.dueDate ? `期限: ${child.dueDate}` : '期限未設定';
  return `${markers}**${child.taskId}** ${child.title} / ${child.assignee || '担当未設定'} / ${dueText} / ${child.status}`;
}

function markerLabel(marker) {
  switch (marker) {
    case 'deadline':
      return ':warning:';
    case 'statusChanged':
      return ':information_source:';
    default:
      return '';
  }
}

