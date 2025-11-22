const REQUIRED_CHILD_FIELDS = ['taskId', 'title', 'dueDate', 'status'];

export function createTaskHierarchyService({
  repository,
  progressService,
  diffDetector = {},
  clock = () => new Date().toISOString()
} = {}) {
  if (!repository) throw new Error('repository が指定されていません。');
  if (!progressService) throw new Error('progressService が指定されていません。');

  async function buildProjectSnapshots({ cursor = 0, limit = Infinity } = {}) {
    const parents = await repository.fetchParentRows({ cursor, limit });
    if (!parents) return [];
    
    // 並列処理でスナップショット生成
    const snapshots = await Promise.all(
      parents.map((parent) => buildSnapshotForParent(parent))
    );
    return snapshots;
  }

  async function buildSnapshotForParent(parentRow) {
    const rawChildren = await repository.fetchChildRows(parentRow.projectId) || [];
    const { validChildren, invalidChildren } = partitionChildren(rawChildren);
    
    // diffDetector はオプションなのでそのまま
    const annotatedChildren = validChildren.map((child) => ({
      ...child,
      markers: diffDetector.diff?.(parentRow.projectId, child) ?? []
    }));

    const completion = progressService.calculate(annotatedChildren);
    const shouldPost = progressService.shouldUpdate?.(parentRow.projectId, completion) ?? true;

    return {
      rowIndex: parentRow.rowIndex,
      projectId: parentRow.projectId,
      title: parentRow.title,
      owner: parentRow.owner,
      threadId: parentRow.threadId,
      timestamp: clock(),
      completion,
      children: annotatedChildren,
      invalidChildren,
      shouldPost
    };
  }

  async function markThread({ rowIndex, threadId }) {
    if (!rowIndex || !threadId) {
      throw new Error('rowIndex と threadId を指定してください。');
    }
    return repository.updateThreadId({ rowIndex, threadId });
  }
  
  function saveProgress(projectId, completion) {
    progressService.persist?.(projectId, {
        ...completion,
        updatedAt: clock()
    });
  }

  function partitionChildren(children) {
    const validChildren = [];
    const invalidChildren = [];

    children.forEach((child) => {
      const missing = REQUIRED_CHILD_FIELDS.filter((field) => !stringValue(child[field]));
      if (missing.length) {
        invalidChildren.push({
          taskId: child.taskId || '不明',
          reason: `${missing.join(', ')} が未入力です。`
        });
        return;
      }
      validChildren.push(child);
    });

    return { validChildren, invalidChildren };
  }

  function stringValue(value) {
    if (value === null || value === undefined) return false;
    return String(value).trim().length > 0;
  }

  return {
    buildProjectSnapshots,
    markThread,
    saveProgress
  };
}

