import {
  getParameterDefinition,
  isSameValue,
  SYSTEM_PARAM_DEFAULTS,
  SYSTEM_PARAMETERS,
  toOrderRules,
  validateParameterValue,
} from '@/config/systemParams'
import type {
  ChangeRequestFilter,
  CreateChangeRequest,
  OrderRules,
  ParameterChangeRequest,
  SystemParameter,
  SystemParameterCode,
  SystemParameterValue,
  SystemParameterValues,
} from '@/types'
import { EngineError } from './engine'

/** Lần đổi gần nhất của một tham số, để màn cấu hình hiện người sửa và thời điểm sửa. */
interface LastChange {
  maker: string
  checker: string
  time: string
}

export interface ConfigState {
  values: SystemParameterValues
  lastChanges: Array<[SystemParameterCode, LastChange]>
  requests: ParameterChangeRequest[]
  requestSequence: number
}

interface ConfigStoreOptions {
  /** Thời điểm ghi nhật ký. Ứng dụng truyền đồng hồ giả lập để khớp với OrderEvent. */
  now?: () => string
}

const cloneValue = (value: SystemParameterValue): SystemParameterValue => (Array.isArray(value) ? [...value] : value)

const cloneValues = (values: SystemParameterValues): SystemParameterValues => ({
  ...values,
  ENABLED_STRATEGIES: [...values.ENABLED_STRATEGIES],
})

/**
 * Cấu hình hệ thống theo maker-checker: người A tạo yêu cầu, người B khác A duyệt thì giá trị mới mới có hiệu lực.
 * Mỗi tham số chỉ có một yêu cầu chờ duyệt tại một thời điểm.
 */
export function createConfigStore(options: ConfigStoreOptions = {}) {
  const now = options.now ?? (() => new Date().toISOString())
  let values = cloneValues(SYSTEM_PARAM_DEFAULTS)
  let lastChanges = new Map<SystemParameterCode, LastChange>()
  let requests: ParameterChangeRequest[] = []
  let requestSequence = 0

  function getValue<Code extends SystemParameterCode>(code: Code): SystemParameterValues[Code] {
    return values[code]
  }

  function getOrderRules(): OrderRules {
    return toOrderRules(values)
  }

  function findPending(code: SystemParameterCode) {
    return requests.find((request) => request.parameter_code === code && request.status === 'PENDING') ?? null
  }

  function listParameters(): SystemParameter[] {
    return SYSTEM_PARAMETERS.map((definition) => {
      const last = lastChanges.get(definition.code)
      return {
        parameter_code: definition.code,
        label: definition.label,
        description: definition.description,
        data_type: definition.data_type,
        scope: definition.scope,
        unit: definition.unit,
        min: definition.min,
        max: definition.max,
        step: definition.step,
        value: cloneValue(values[definition.code]),
        default_value: cloneValue(SYSTEM_PARAM_DEFAULTS[definition.code]),
        updated_by: last?.maker ?? null,
        approved_by: last?.checker ?? null,
        updated_at: last?.time ?? null,
        pending_request: findPending(definition.code),
      }
    })
  }

  function requireKnownCode(code: string): SystemParameterCode {
    if (!SYSTEM_PARAMETERS.some((definition) => definition.code === code)) {
      throw new EngineError('Không tìm thấy tham số', 404)
    }
    return code as SystemParameterCode
  }

  function validateOrThrow(code: SystemParameterCode, value: unknown) {
    const error = validateParameterValue(code, value, values)
    if (error) throw new EngineError(error, 422)
  }

  function createRequest(body: CreateChangeRequest, maker: string): ParameterChangeRequest {
    const code = requireKnownCode(body.parameter_code)
    const reason = (body.reason ?? '').trim()
    if (reason === '') throw new EngineError('Phải nhập lý do thay đổi', 422)
    validateOrThrow(code, body.new_value)
    if (isSameValue(body.new_value, values[code])) {
      throw new EngineError('Giá trị mới trùng giá trị đang áp dụng', 422)
    }
    if (findPending(code)) {
      throw new EngineError(`${getParameterDefinition(code).label} đang có một yêu cầu chờ duyệt`, 409)
    }

    requestSequence += 1
    const request: ParameterChangeRequest = {
      request_id: `CR-${String(requestSequence).padStart(4, '0')}`,
      parameter_code: code,
      old_value: cloneValue(values[code]),
      new_value: cloneValue(body.new_value),
      reason,
      maker,
      checker: null,
      note: null,
      status: 'PENDING',
      created_at: now(),
      decided_at: null,
    }
    requests.push(request)
    return request
  }

  /** Người duyệt phải khác người tạo, và yêu cầu phải còn chờ duyệt. */
  function requireDecidable(requestId: string, checker: string) {
    const request = requests.find((item) => item.request_id === requestId)
    if (!request) throw new EngineError('Không tìm thấy yêu cầu thay đổi', 404)
    if (request.status !== 'PENDING') throw new EngineError('Yêu cầu này đã được xử lý')
    if (request.maker === checker) {
      throw new EngineError('Người tạo yêu cầu không được tự duyệt hoặc từ chối yêu cầu của mình', 403)
    }
    return request
  }

  function approveRequest(requestId: string, note: string, checker: string): ParameterChangeRequest {
    const request = requireDecidable(requestId, checker)
    // Kiểm tra lại theo giá trị đang áp dụng: tham số liên quan có thể đã đổi từ lúc tạo yêu cầu.
    validateOrThrow(request.parameter_code, request.new_value)

    const time = now()
    request.old_value = cloneValue(values[request.parameter_code])
    values = { ...values, [request.parameter_code]: cloneValue(request.new_value) }
    lastChanges.set(request.parameter_code, { maker: request.maker, checker, time })
    request.status = 'APPROVED'
    request.checker = checker
    request.note = note.trim() || null
    request.decided_at = time
    return request
  }

  function rejectRequest(requestId: string, note: string, checker: string): ParameterChangeRequest {
    const request = requireDecidable(requestId, checker)
    const trimmed = note.trim()
    if (trimmed === '') throw new EngineError('Phải nhập ghi chú khi từ chối', 422)
    request.status = 'REJECTED'
    request.checker = checker
    request.note = trimmed
    request.decided_at = now()
    return request
  }

  /** Lịch sử thay đổi, mới nhất trước. `user` khớp người tạo hoặc người duyệt. */
  function listRequests(filter: ChangeRequestFilter = {}): ParameterChangeRequest[] {
    return requests
      .filter(
        (request) =>
          (!filter.parameter_code || request.parameter_code === filter.parameter_code) &&
          (!filter.status || request.status === filter.status) &&
          (!filter.user || request.maker === filter.user || request.checker === filter.user),
      )
      .reverse()
  }

  function exportState(): ConfigState {
    return { values: cloneValues(values), lastChanges: [...lastChanges], requests, requestSequence }
  }

  function importState(state: ConfigState) {
    values = { ...cloneValues(SYSTEM_PARAM_DEFAULTS), ...state.values }
    lastChanges = new Map(state.lastChanges)
    requests = state.requests
    requestSequence = state.requestSequence
  }

  function reset() {
    values = cloneValues(SYSTEM_PARAM_DEFAULTS)
    lastChanges = new Map()
    requests = []
    requestSequence = 0
  }

  return {
    getValue,
    getOrderRules,
    listParameters,
    createRequest,
    approveRequest,
    rejectRequest,
    listRequests,
    exportState,
    importState,
    reset,
  }
}

export type ConfigStore = ReturnType<typeof createConfigStore>
