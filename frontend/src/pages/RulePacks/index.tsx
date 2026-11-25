import { ErrorState, LoadingState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SESSION_LABELS } from '@/config/hose'
import { useRulePacks, useSetExperimentalPack } from '@/hooks/useRules'
import { formatDate, formatNumber } from '@/lib/format'
import { describeTickTable } from '@/rules/describe'
import { BOARD_LABELS } from '@/rules/symbols'
import type { RuleFlag, RulePack } from '@/rules/types'

const NO_LUNCH_PACK = 'sto-experimental-no-lunch'

function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <Badge className="bg-status-success-bg text-status-success">Đã kiểm chứng</Badge>
  ) : (
    <Badge className="bg-status-warning-bg text-status-warning">Chưa kiểm chứng</Badge>
  )
}

function effective(pack: RulePack) {
  const from = formatDate(pack.effectiveFrom)
  return pack.effectiveTo ? `${from} – ${formatDate(pack.effectiveTo)}` : `Từ ${from}`
}

function sessionsText(pack: RulePack) {
  return pack.sessions.map((item) => `${SESSION_LABELS[item.code]} ${item.start}–${item.end}`).join(' · ')
}

function PackDetail({ pack }: { pack: RulePack }) {
  const rows: Array<[string, string]> = [
    ['Phiên', sessionsText(pack)],
    ['Hết hiệu lực lệnh trong ngày', pack.expiryTime],
    ['Biên độ', `±${pack.priceBand.normal}% (ngày đầu ±${pack.priceBand.firstDay}%)`],
    ['Bước giá cổ phiếu', describeTickTable(pack.tickTable.STOCK)],
    ['Bước giá ETF, chứng quyền', `${describeTickTable(pack.tickTable.ETF)} / ${describeTickTable(pack.tickTable.CW)}`],
    ['Lô', `lô chẵn bội số ${pack.lots.round}, tối đa ${formatNumber(pack.maxQty.round)} CP; lô lẻ ${pack.lots.odd.min}–${pack.lots.odd.max} CP, chỉ LO`],
    ['Sửa lệnh', `${pack.amendPolicy.oneFieldPerAmend ? 'mỗi lần chỉ giá hoặc KL' : 'được đổi cả hai'}; mất ưu tiên khi ${pack.amendPolicy.losesPriority.map((kind) => (kind === 'PRICE' ? 'đổi giá' : kind === 'QTY_UP' ? 'tăng KL' : 'giảm KL')).join(', ')}`],
    ['Khóa sửa, hủy', pack.amendPolicy.lockedSessions.length ? pack.amendPolicy.lockedSessions.map((code) => SESSION_LABELS[code]).join(', ') : 'không'],
    ['MTL phần còn lại', pack.mtlRemainder === 'LO_LAST_PLUS_TICK' ? 'chuyển LO giá khớp gần nhất ± 1 bước' : 'hủy'],
    ['Giá tham chiếu', pack.referencePrice === 'VWAP_PREV' ? 'bình quân gia quyền phiên trước' : 'giá đóng cửa phiên trước'],
  ]
  return (
    <dl className="grid grid-cols-[minmax(10rem,auto)_1fr] gap-x-4 gap-y-1 text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function FlagList({ pack }: { pack: RulePack }) {
  const flags = Object.entries(pack.flags) as Array<[RuleFlag, NonNullable<RulePack['flags'][RuleFlag]>]>
  if (flags.length === 0) return <span className="text-muted-foreground text-xs">Không có</span>
  return (
    <ul className="flex flex-col gap-1 text-xs">
      {flags.map(([key, flag]) => (
        <li key={key} title={flag.note}>
          <span className="font-mono">{key}</span>: {flag.enabled ? 'bật' : 'tắt'}{' '}
          {!flag.verified && <Badge variant="secondary">{flag.label}</Badge>}
        </li>
      ))}
    </ul>
  )
}

/** Trang Luật giao dịch (chỉ OPS, chỉ đọc): các gói luật theo bảng × ngày hiệu lực, cờ chưa kiểm chứng, pack thử nghiệm. */
export default function RulePacks() {
  const packs = useRulePacks()
  const setExperimental = useSetExperimentalPack()

  let body
  if (packs.isPending) body = <LoadingState />
  else if (packs.error) {
    body = <ErrorState message={`Không tải được gói luật: ${packs.error.message}`} onRetry={() => void packs.refetch()} />
  } else {
    const { trading_date: date, active, experimental_id: experimentalId } = packs.data
    const activeIds = new Set(Object.values(active))
    const trying = experimentalId === NO_LUNCH_PACK
    body = (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            Ngày mô phỏng <span className="font-medium tabular-nums">{formatDate(date)}</span>. Pack đang áp dụng được chọn theo bảng
            giao dịch và ngày hiệu lực.
          </p>
          <Button
            variant={trying ? 'default' : 'outline'}
            disabled={setExperimental.isPending}
            data-demo-id="try-no-lunch"
            onClick={() => setExperimental.mutate(trying ? null : NO_LUNCH_PACK)}
          >
            {trying ? 'Bỏ cấu hình thử' : 'Thử cấu hình bỏ nghỉ trưa'}
          </Button>
        </div>
        {trying && (
          <p role="status" className="bg-primary/10 rounded-md p-2 text-xs" data-demo-id="experimental-active">
            Đang dùng pack thử nghiệm: HOSE khớp liên tục 09:15–14:30, không nghỉ trưa. Đồng hồ phiên và engine đọc lịch phiên từ pack
            nên đổi ngay, không sửa code. Tải lại trang hoặc bấm “Bỏ cấu hình thử” để quay về luật thật.
          </p>
        )}
        {setExperimental.error && (
          <p role="alert" className="text-destructive text-sm">
            {setExperimental.error.message}
          </p>
        )}
        <div className="overflow-x-auto">
          <Table data-demo-id="rule-packs-table">
            <TableHeader>
              <TableRow>
                <TableHead>Gói luật</TableHead>
                <TableHead>Bảng</TableHead>
                <TableHead>Hiệu lực</TableHead>
                <TableHead>Kiểm chứng</TableHead>
                <TableHead>Cờ cấu hình</TableHead>
                <TableHead>Nguồn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packs.data.packs.map((pack) => (
                <TableRow key={pack.id} data-pack-id={pack.id} className="align-top">
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      {pack.title}
                      {activeIds.has(pack.id) && <Badge className="bg-status-info-bg text-status-info">Đang áp dụng</Badge>}
                      {pack.experimental && <Badge variant="outline">Thử nghiệm</Badge>}
                    </div>
                    <div className="text-muted-foreground font-mono text-xs">{pack.id}</div>
                    <div className="mt-2">
                      <PackDetail pack={pack} />
                    </div>
                  </TableCell>
                  <TableCell>{BOARD_LABELS[pack.board]} ({pack.board})</TableCell>
                  <TableCell className="whitespace-nowrap">{pack.experimental ? 'Chỉ khi nạp thử' : effective(pack)}</TableCell>
                  <TableCell>
                    <VerifiedBadge verified={pack.verified} />
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <FlagList pack={pack} />
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-56 text-xs whitespace-normal">{pack.sourceNote}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Luật giao dịch</h1>
        </CardTitle>
        <CardDescription>
          Luật giao dịch theo KRX, viết thành dữ liệu cấu hình theo bảng giao dịch × ngày hiệu lực. Trang chỉ đọc: đổi luật là thêm
          hoặc sửa một gói luật, không sửa code. Điểm chưa rõ là cờ có nhãn “Chưa kiểm chứng” hoặc “Giả định”.
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
