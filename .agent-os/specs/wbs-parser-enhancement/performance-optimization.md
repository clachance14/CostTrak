# WBS Parser Enhancement - Performance Optimization

**Version**: 1.0.0  
**Last Updated**: 2025-01-30

## Overview

This document outlines performance optimization strategies for the 5-level WBS parser to handle large Excel files (50MB+), thousands of line items, and complex hierarchical calculations efficiently.

## Performance Targets

### Import Performance
- **Small files (<5MB)**: < 2 seconds
- **Medium files (5-20MB)**: < 10 seconds
- **Large files (20-50MB)**: < 30 seconds
- **Extra large files (50MB+)**: < 60 seconds

### Query Performance
- **Single project WBS tree**: < 100ms
- **Budget vs actual comparison**: < 200ms
- **Multi-project rollups**: < 500ms
- **Export generation**: < 5 seconds

### Memory Usage
- **Peak memory**: < 500MB for 50MB file
- **Baseline memory**: < 100MB idle
- **Garbage collection**: < 50ms pauses

## Optimization Strategies

### 1. Streaming Parser Implementation

#### 1.1 Stream Processing for Large Files

```typescript
import { Transform, Readable } from 'stream'
import * as XLSX from 'xlsx'

export class StreamingExcelParser {
  private readonly CHUNK_SIZE = 1000 // Process 1000 rows at a time
  
  async parseStream(fileStream: Readable): Promise<void> {
    const parser = new ExcelStreamTransform({
      chunkSize: this.CHUNK_SIZE,
      highWaterMark: 16384 // 16KB buffer
    })
    
    const processor = new LineItemProcessor()
    const dbWriter = new BatchDatabaseWriter({
      batchSize: 500,
      flushInterval: 1000 // ms
    })
    
    // Create processing pipeline
    await pipeline(
      fileStream,
      parser,
      processor,
      dbWriter
    )
  }
}

class ExcelStreamTransform extends Transform {
  private buffer: any[] = []
  private rowIndex = 0
  
  constructor(private options: StreamOptions) {
    super({ objectMode: true })
  }
  
  _transform(chunk: any, encoding: string, callback: Function) {
    try {
      // Parse chunk of Excel data
      const rows = this.parseChunk(chunk)
      
      for (const row of rows) {
        this.buffer.push(row)
        
        if (this.buffer.length >= this.options.chunkSize) {
          this.push({
            rows: this.buffer.splice(0),
            startIndex: this.rowIndex
          })
          this.rowIndex += this.options.chunkSize
        }
      }
      
      callback()
    } catch (error) {
      callback(error)
    }
  }
  
  _flush(callback: Function) {
    if (this.buffer.length > 0) {
      this.push({
        rows: this.buffer,
        startIndex: this.rowIndex
      })
    }
    callback()
  }
}
```

#### 1.2 Memory-Efficient Sheet Reading

```typescript
export class MemoryEfficientReader {
  async readSheet(filePath: string, sheetName: string): Promise<AsyncIterator<any[]>> {
    // Use XLSX stream API for large files
    const stream = XLSX.stream.to_json({
      file: filePath,
      sheet: sheetName,
      raw: false,
      defval: null
    })
    
    return {
      async *[Symbol.asyncIterator]() {
        const buffer: any[] = []
        const BATCH_SIZE = 100
        
        for await (const row of stream) {
          buffer.push(row)
          
          if (buffer.length >= BATCH_SIZE) {
            yield buffer.splice(0)
          }
        }
        
        if (buffer.length > 0) {
          yield buffer
        }
      }
    }
  }
}
```

### 2. Database Query Optimization

#### 2.1 Indexed Columns

```sql
-- Essential indexes for WBS queries
CREATE INDEX idx_wbs_project_code ON wbs_structure(project_id, code);
CREATE INDEX idx_wbs_parent_code ON wbs_structure(parent_code);
CREATE INDEX idx_wbs_level ON wbs_structure(level);
CREATE INDEX idx_wbs_path ON wbs_structure USING GIN(path); -- For array containment

-- Composite indexes for common queries
CREATE INDEX idx_wbs_project_level_code ON wbs_structure(project_id, level, code);
CREATE INDEX idx_budget_items_wbs ON budget_line_items(project_id, wbs_code);

-- Partial indexes for filtered queries
CREATE INDEX idx_wbs_level5 ON wbs_structure(project_id, code) WHERE level = 5;
CREATE INDEX idx_wbs_has_children ON wbs_structure(code) WHERE children_count > 0;
```

#### 2.2 Materialized Views for Rollups

```sql
-- Pre-calculated WBS rollups
CREATE MATERIALIZED VIEW mv_wbs_rollups AS
WITH RECURSIVE wbs_tree AS (
  -- Base case: leaf nodes (level 5)
  SELECT 
    w.id,
    w.project_id,
    w.code,
    w.parent_code,
    w.level,
    w.budget_total,
    w.labor_cost,
    w.material_cost,
    w.equipment_cost,
    w.subcontract_cost,
    w.other_cost,
    w.budget_total as rollup_total,
    w.labor_cost as rollup_labor,
    w.material_cost as rollup_material,
    w.equipment_cost as rollup_equipment,
    w.subcontract_cost as rollup_subcontract,
    w.other_cost as rollup_other
  FROM wbs_structure w
  WHERE NOT EXISTS (
    SELECT 1 FROM wbs_structure c WHERE c.parent_code = w.code
  )
  
  UNION ALL
  
  -- Recursive case: parent nodes
  SELECT 
    p.id,
    p.project_id,
    p.code,
    p.parent_code,
    p.level,
    p.budget_total,
    p.labor_cost,
    p.material_cost,
    p.equipment_cost,
    p.subcontract_cost,
    p.other_cost,
    SUM(c.rollup_total) as rollup_total,
    SUM(c.rollup_labor) as rollup_labor,
    SUM(c.rollup_material) as rollup_material,
    SUM(c.rollup_equipment) as rollup_equipment,
    SUM(c.rollup_subcontract) as rollup_subcontract,
    SUM(c.rollup_other) as rollup_other
  FROM wbs_structure p
  JOIN wbs_tree c ON c.parent_code = p.code
  GROUP BY p.id, p.project_id, p.code, p.parent_code, p.level,
           p.budget_total, p.labor_cost, p.material_cost,
           p.equipment_cost, p.subcontract_cost, p.other_cost
)
SELECT * FROM wbs_tree;

-- Index the materialized view
CREATE INDEX idx_mv_wbs_rollups_project_code ON mv_wbs_rollups(project_id, code);

-- Refresh strategy
CREATE OR REPLACE FUNCTION refresh_wbs_rollups(p_project_id UUID)
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_wbs_rollups
  WHERE project_id = p_project_id;
END;
$$ LANGUAGE plpgsql;
```

#### 2.3 Query Optimization Patterns

```typescript
export class OptimizedWBSQueries {
  // Use CTEs for complex hierarchical queries
  async getWBSTreeOptimized(projectId: string): Promise<WBSNode[]> {
    const query = `
      WITH RECURSIVE wbs_hierarchy AS (
        -- Anchor: root node
        SELECT 
          w.*,
          ARRAY[w.sort_order] as path_array,
          0 as depth
        FROM wbs_structure w
        WHERE w.project_id = $1 AND w.parent_code IS NULL
        
        UNION ALL
        
        -- Recursive: child nodes
        SELECT 
          w.*,
          h.path_array || w.sort_order as path_array,
          h.depth + 1 as depth
        FROM wbs_structure w
        JOIN wbs_hierarchy h ON w.parent_code = h.code
        WHERE w.project_id = $1
      )
      SELECT * FROM wbs_hierarchy
      ORDER BY path_array;
    `
    
    return this.db.query(query, [projectId])
  }
  
  // Batch load children to avoid N+1 queries
  async loadWBSWithChildren(projectId: string): Promise<Map<string, WBSNode>> {
    // Load all nodes in one query
    const nodes = await this.db.query(`
      SELECT * FROM wbs_structure 
      WHERE project_id = $1 
      ORDER BY level, sort_order
    `, [projectId])
    
    // Build parent-child relationships in memory
    const nodeMap = new Map<string, WBSNode>()
    const childrenMap = new Map<string, WBSNode[]>()
    
    // First pass: create all nodes
    for (const node of nodes) {
      nodeMap.set(node.code, { ...node, children: [] })
    }
    
    // Second pass: link parents to children
    for (const node of nodes) {
      if (node.parent_code) {
        const parent = nodeMap.get(node.parent_code)
        if (parent) {
          parent.children.push(nodeMap.get(node.code)!)
        }
      }
    }
    
    return nodeMap
  }
}
```

### 3. Caching Strategies

#### 3.1 Multi-Layer Cache Architecture

```typescript
export class WBSCacheManager {
  private readonly memoryCache = new LRUCache<string, any>({
    max: 500, // Max 500 items
    maxSize: 100 * 1024 * 1024, // 100MB
    sizeCalculation: (value) => JSON.stringify(value).length,
    ttl: 1000 * 60 * 5 // 5 minutes
  })
  
  private readonly redisCache = new Redis({
    host: process.env.REDIS_HOST,
    keyPrefix: 'wbs:',
    ttl: 60 * 60 // 1 hour
  })
  
  async get<T>(key: string): Promise<T | null> {
    // L1: Memory cache
    const memResult = this.memoryCache.get(key)
    if (memResult) {
      return memResult as T
    }
    
    // L2: Redis cache
    const redisResult = await this.redisCache.get(key)
    if (redisResult) {
      const parsed = JSON.parse(redisResult)
      this.memoryCache.set(key, parsed) // Promote to L1
      return parsed as T
    }
    
    return null
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Write to both caches
    this.memoryCache.set(key, value)
    await this.redisCache.setex(
      key, 
      ttl || 3600, 
      JSON.stringify(value)
    )
  }
  
  // Cache warming for frequently accessed data
  async warmCache(projectId: string): Promise<void> {
    const keys = [
      `wbs:tree:${projectId}`,
      `wbs:rollups:${projectId}`,
      `wbs:level3:${projectId}`,
      `budget:summary:${projectId}`
    ]
    
    await Promise.all(
      keys.map(key => this.loadAndCache(key))
    )
  }
}
```

#### 3.2 Smart Invalidation

```typescript
export class CacheInvalidator {
  private readonly patterns = {
    project: (id: string) => [`wbs:*:${id}`, `budget:*:${id}`],
    wbsNode: (projectId: string, code: string) => [
      `wbs:node:${projectId}:${code}`,
      `wbs:tree:${projectId}`,
      `wbs:rollups:${projectId}`
    ],
    budgetItem: (projectId: string, wbsCode: string) => [
      `budget:*:${projectId}:${wbsCode}`,
      `wbs:rollups:${projectId}`
    ]
  }
  
  async invalidateProject(projectId: string): Promise<void> {
    const patterns = this.patterns.project(projectId)
    await this.invalidatePatterns(patterns)
  }
  
  async invalidateWBSNode(projectId: string, code: string): Promise<void> {
    const patterns = this.patterns.wbsNode(projectId, code)
    await this.invalidatePatterns(patterns)
  }
  
  private async invalidatePatterns(patterns: string[]): Promise<void> {
    const pipeline = this.redis.pipeline()
    
    for (const pattern of patterns) {
      // Use SCAN to find matching keys
      const keys = await this.scanKeys(pattern)
      keys.forEach(key => pipeline.del(key))
    }
    
    await pipeline.exec()
  }
}
```

### 4. Memory Management

#### 4.1 Object Pooling

```typescript
export class ObjectPool<T> {
  private pool: T[] = []
  private activeCount = 0
  
  constructor(
    private factory: () => T,
    private reset: (obj: T) => void,
    private maxSize: number = 100
  ) {}
  
  acquire(): T {
    if (this.pool.length > 0) {
      this.activeCount++
      return this.pool.pop()!
    }
    
    this.activeCount++
    return this.factory()
  }
  
  release(obj: T): void {
    this.reset(obj)
    this.activeCount--
    
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj)
    }
  }
}

// Usage for WBS nodes
const wbsNodePool = new ObjectPool<WBSNode>(
  () => ({
    id: '',
    code: '',
    level: 1,
    description: '',
    children: [],
    budget_total: 0,
    labor_cost: 0,
    material_cost: 0,
    equipment_cost: 0,
    subcontract_cost: 0,
    other_cost: 0
  }),
  (node) => {
    // Reset node to initial state
    node.id = ''
    node.code = ''
    node.children = []
    node.budget_total = 0
    // ... reset other fields
  },
  1000 // Pool up to 1000 nodes
)
```

#### 4.2 Memory-Conscious Data Structures

```typescript
export class CompactWBSNode {
  // Use typed arrays for numeric data
  private static readonly FLOAT_FIELDS = 6
  private floatData: Float32Array
  
  constructor(
    public id: string,
    public code: string,
    public level: number,
    public description: string
  ) {
    this.floatData = new Float32Array(CompactWBSNode.FLOAT_FIELDS)
  }
  
  // Getters/setters for numeric fields
  get budget_total(): number { return this.floatData[0] }
  set budget_total(v: number) { this.floatData[0] = v }
  
  get labor_cost(): number { return this.floatData[1] }
  set labor_cost(v: number) { this.floatData[1] = v }
  
  // ... other numeric fields
  
  // Approximate memory usage: 
  // Strings: ~100 bytes
  // Float32Array: 24 bytes
  // Total: ~124 bytes vs ~200 bytes for regular object
}
```

### 5. Parallel Processing

#### 5.1 Worker Thread Pool

```typescript
import { Worker } from 'worker_threads'
import { cpus } from 'os'

export class WorkerPool {
  private workers: Worker[] = []
  private queue: Array<{
    task: any
    resolve: (value: any) => void
    reject: (error: any) => void
  }> = []
  
  constructor(
    private workerScript: string,
    private poolSize: number = cpus().length
  ) {
    this.initializeWorkers()
  }
  
  private initializeWorkers() {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(this.workerScript)
      
      worker.on('message', (result) => {
        const task = this.queue.shift()
        if (task) {
          task.resolve(result)
        }
      })
      
      worker.on('error', (error) => {
        const task = this.queue.shift()
        if (task) {
          task.reject(error)
        }
      })
      
      this.workers.push(worker)
    }
  }
  
  async execute<T>(data: any): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task: data, resolve, reject })
      
      // Find available worker
      const worker = this.workers.find(w => !w.threadId)
      if (worker) {
        worker.postMessage(data)
      }
    })
  }
  
  async terminate() {
    await Promise.all(
      this.workers.map(w => w.terminate())
    )
  }
}

// Worker script for Excel parsing
// excel-parser.worker.ts
const { parentPort } = require('worker_threads')

parentPort.on('message', async (data) => {
  try {
    const { sheet, startRow, endRow } = data
    const result = await parseSheetRange(sheet, startRow, endRow)
    parentPort.postMessage(result)
  } catch (error) {
    parentPort.postMessage({ error: error.message })
  }
})
```

#### 5.2 Parallel Sheet Processing

```typescript
export class ParallelExcelProcessor {
  private workerPool: WorkerPool
  
  constructor() {
    this.workerPool = new WorkerPool(
      './workers/excel-parser.worker.js',
      4 // Use 4 workers
    )
  }
  
  async processWorkbook(workbook: XLSX.WorkBook): Promise<ProcessedData> {
    const sheets = [
      'BUDGETS',
      'STAFF',
      'DIRECTS',
      'MATERIALS',
      'GENERAL EQUIPMENT',
      'CONSTRUCTABILITY'
    ]
    
    // Process sheets in parallel
    const results = await Promise.all(
      sheets.map(sheetName => 
        this.processSheet(workbook.Sheets[sheetName], sheetName)
      )
    )
    
    // Merge results
    return this.mergeResults(results)
  }
  
  private async processSheet(sheet: XLSX.WorkSheet, name: string) {
    const rowCount = this.getRowCount(sheet)
    const chunkSize = Math.ceil(rowCount / 4) // Divide among 4 workers
    
    const tasks = []
    for (let i = 0; i < 4; i++) {
      const startRow = i * chunkSize
      const endRow = Math.min((i + 1) * chunkSize, rowCount)
      
      tasks.push(
        this.workerPool.execute({
          sheet: sheet,
          sheetName: name,
          startRow,
          endRow
        })
      )
    }
    
    const chunks = await Promise.all(tasks)
    return this.combineChunks(chunks)
  }
}
```

### 6. Import Pipeline Optimization

#### 6.1 Batch Processing Pipeline

```typescript
export class OptimizedImportPipeline {
  private readonly BATCH_SIZE = 1000
  private readonly QUEUE_SIZE = 5000
  
  async importFile(file: File, projectId: string): Promise<ImportResult> {
    const pipeline = new ImportPipeline([
      new FileValidator(),
      new ExcelReader({ streaming: true }),
      new DataTransformer({ parallel: true }),
      new DataValidator({ concurrent: true }),
      new WBSBuilder({ batchSize: this.BATCH_SIZE }),
      new DatabaseWriter({ 
        batchSize: this.BATCH_SIZE,
        parallel: true 
      })
    ])
    
    const progressTracker = new ProgressTracker()
    
    return pipeline.execute({
      file,
      projectId,
      onProgress: (progress) => progressTracker.update(progress)
    })
  }
}

class DatabaseWriter extends PipelineStage {
  private queue: BudgetLineItem[] = []
  private insertPromises: Promise<void>[] = []
  
  async process(items: BudgetLineItem[]): Promise<void> {
    this.queue.push(...items)
    
    if (this.queue.length >= this.options.batchSize) {
      const batch = this.queue.splice(0, this.options.batchSize)
      
      // Non-blocking insert
      const promise = this.insertBatch(batch)
      this.insertPromises.push(promise)
      
      // Limit concurrent inserts
      if (this.insertPromises.length >= 3) {
        await Promise.race(this.insertPromises)
        this.insertPromises = this.insertPromises.filter(
          p => p !== promise
        )
      }
    }
  }
  
  async flush(): Promise<void> {
    // Insert remaining items
    if (this.queue.length > 0) {
      await this.insertBatch(this.queue)
    }
    
    // Wait for all inserts to complete
    await Promise.all(this.insertPromises)
  }
  
  private async insertBatch(items: BudgetLineItem[]): Promise<void> {
    const query = `
      INSERT INTO budget_line_items 
      (id, project_id, wbs_code, description, ...)
      VALUES 
      ${items.map((_, i) => 
        `($${i*10+1}, $${i*10+2}, $${i*10+3}, ...)`
      ).join(',')}
      ON CONFLICT (id) DO UPDATE SET
        updated_at = NOW()
    `
    
    const values = items.flatMap(item => [
      item.id,
      item.project_id,
      item.wbs_code,
      // ... other fields
    ])
    
    await this.db.query(query, values)
  }
}
```

### 7. Monitoring & Profiling

#### 7.1 Performance Metrics Collection

```typescript
export class PerformanceMonitor {
  private metrics: Map<string, Metric> = new Map()
  
  startTimer(name: string): () => void {
    const start = performance.now()
    
    return () => {
      const duration = performance.now() - start
      this.recordMetric(name, duration)
    }
  }
  
  async measureAsync<T>(
    name: string, 
    fn: () => Promise<T>
  ): Promise<T> {
    const start = performance.now()
    
    try {
      const result = await fn()
      const duration = performance.now() - start
      this.recordMetric(name, duration)
      return result
    } catch (error) {
      this.recordError(name, error)
      throw error
    }
  }
  
  recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        count: 0,
        total: 0,
        min: Infinity,
        max: -Infinity,
        avg: 0
      })
    }
    
    const metric = this.metrics.get(name)!
    metric.count++
    metric.total += value
    metric.min = Math.min(metric.min, value)
    metric.max = Math.max(metric.max, value)
    metric.avg = metric.total / metric.count
  }
  
  getReport(): PerformanceReport {
    const report: PerformanceReport = {
      timestamp: new Date(),
      metrics: {}
    }
    
    this.metrics.forEach((metric, name) => {
      report.metrics[name] = {
        ...metric,
        p95: this.calculatePercentile(name, 95),
        p99: this.calculatePercentile(name, 99)
      }
    })
    
    return report
  }
}

// Usage
const monitor = new PerformanceMonitor()

// Measure import performance
const result = await monitor.measureAsync(
  'excel.import.total',
  async () => {
    const readTime = monitor.startTimer('excel.import.read')
    const data = await readExcel(file)
    readTime()
    
    const parseTime = monitor.startTimer('excel.import.parse')
    const parsed = await parseData(data)
    parseTime()
    
    const dbTime = monitor.startTimer('excel.import.database')
    await saveToDatabase(parsed)
    dbTime()
    
    return parsed
  }
)
```

#### 7.2 Memory Profiling

```typescript
export class MemoryProfiler {
  private baseline: NodeJS.MemoryUsage
  private snapshots: MemorySnapshot[] = []
  
  start() {
    this.baseline = process.memoryUsage()
    this.startPeriodicSnapshots()
  }
  
  private startPeriodicSnapshots() {
    setInterval(() => {
      const current = process.memoryUsage()
      const snapshot: MemorySnapshot = {
        timestamp: Date.now(),
        heapUsed: current.heapUsed - this.baseline.heapUsed,
        heapTotal: current.heapTotal,
        external: current.external,
        arrayBuffers: current.arrayBuffers
      }
      
      this.snapshots.push(snapshot)
      
      // Keep only last 1000 snapshots
      if (this.snapshots.length > 1000) {
        this.snapshots.shift()
      }
      
      // Check for memory leaks
      this.checkForLeaks()
    }, 1000) // Every second
  }
  
  private checkForLeaks() {
    if (this.snapshots.length < 60) return // Need 1 minute of data
    
    const recent = this.snapshots.slice(-60)
    const trend = this.calculateTrend(recent.map(s => s.heapUsed))
    
    if (trend > 1024 * 1024) { // Growing by >1MB/minute
      console.warn('Potential memory leak detected:', {
        growthRate: `${(trend / 1024 / 1024).toFixed(2)}MB/min`,
        currentHeap: `${(recent[recent.length - 1].heapUsed / 1024 / 1024).toFixed(2)}MB`
      })
    }
  }
  
  private calculateTrend(values: number[]): number {
    // Simple linear regression
    const n = values.length
    const sumX = (n * (n - 1)) / 2
    const sumY = values.reduce((a, b) => a + b, 0)
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0)
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    return slope * 60 // Growth per minute
  }
}
```

### 8. Best Practices Summary

#### 8.1 DO's
- ✅ Stream large files instead of loading into memory
- ✅ Use database indexes on frequently queried columns
- ✅ Implement multi-layer caching with TTL
- ✅ Process data in batches
- ✅ Use worker threads for CPU-intensive tasks
- ✅ Monitor performance metrics in production
- ✅ Implement circuit breakers for external dependencies
- ✅ Use connection pooling for database

#### 8.2 DON'Ts
- ❌ Don't load entire Excel file into memory
- ❌ Don't make N+1 queries for hierarchical data
- ❌ Don't cache without invalidation strategy
- ❌ Don't process large arrays synchronously
- ❌ Don't ignore memory leaks in long-running processes
- ❌ Don't use recursive queries without depth limits

#### 8.3 Performance Checklist
- [ ] Streaming implemented for files >10MB
- [ ] Database indexes created and analyzed
- [ ] Caching layer implemented with Redis
- [ ] Batch processing for bulk operations
- [ ] Worker threads for parallel processing
- [ ] Memory profiling in place
- [ ] Performance monitoring dashboard
- [ ] Load testing completed
- [ ] Query optimization verified
- [ ] Memory leak detection active

## Performance Testing

### Load Test Scenarios

```typescript
// Load test configuration
export const loadTestScenarios = [
  {
    name: 'Small Project Import',
    fileSize: '2MB',
    lineItems: 500,
    expectedTime: 2000, // 2 seconds
    concurrentUsers: 1
  },
  {
    name: 'Medium Project Import',
    fileSize: '15MB',
    lineItems: 5000,
    expectedTime: 10000, // 10 seconds
    concurrentUsers: 3
  },
  {
    name: 'Large Project Import',
    fileSize: '40MB',
    lineItems: 15000,
    expectedTime: 30000, // 30 seconds
    concurrentUsers: 2
  },
  {
    name: 'Concurrent Imports',
    fileSize: '10MB',
    lineItems: 3000,
    expectedTime: 15000, // 15 seconds
    concurrentUsers: 5
  }
]

// Run load tests
import autocannon from 'autocannon'

async function runLoadTests() {
  for (const scenario of loadTestScenarios) {
    const result = await autocannon({
      url: 'http://localhost:3000/api/projects/import',
      connections: scenario.concurrentUsers,
      duration: 30,
      headers: {
        'content-type': 'multipart/form-data'
      },
      body: createTestFile(scenario.fileSize)
    })
    
    console.log(`Scenario: ${scenario.name}`)
    console.log(`Average response time: ${result.latency.mean}ms`)
    console.log(`Requests per second: ${result.requests.mean}`)
    console.log(`Success rate: ${result.errors ? 
      ((result.requests.total - result.errors) / result.requests.total * 100).toFixed(2) : 100}%`)
  }
}
```

## Conclusion

Implementing these optimization strategies will ensure the WBS parser can handle enterprise-scale projects efficiently. Regular monitoring and profiling will help identify bottlenecks early and maintain optimal performance as the system scales.