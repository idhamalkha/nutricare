import { pool, transaction } from '../db/pool.js';
import { ValidationError, NotFoundError } from '../http/errors.js';
import { bahanStatus } from '../rules/bahan-status.js';
import { validateNoOutOfStock, validateRecipeStock } from '../rules/validations.js';

const slots = ['Sarapan', 'Makan siang', 'Makan malam', 'Snack'];
const todaySql = "(now() AT TIME ZONE 'Asia/Jakarta')::date";
const num = (x: unknown) => Number(x);
const date = (x: unknown) => x instanceof Date ? `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}` : String(x).slice(0,10);
const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
function formatTanggalId(val: unknown): string {
  if (!val) return '-';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-').map(Number);
    return `${d} ${months[m - 1]} ${y}`;
  }
  const dt = val instanceof Date ? val : new Date(String(val));
  if (Number.isNaN(dt.getTime())) return String(val);
  return `${dt.getUTCDate()} ${months[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}
const byName = async (db: any, name: string) => {
  const r = await db.query('SELECT id,nama,stok,satuan,minimum,kedaluwarsa FROM bahan WHERE lower(nama)=lower($1) AND deleted_at IS NULL', [name]);
  if (!r.rowCount) throw new ValidationError(`Bahan ${name} tidak ditemukan.`);
  return r.rows[0];
};
const bahanName = (row: any) => row.bahan_nama;

export async function listStok() {
 const r=await pool.query(`SELECT s.*,b.nama AS bahan_nama FROM stok_transaksi s JOIN bahan b ON b.id=s.bahan_id ORDER BY s.tanggal DESC,s.created_at DESC`);
 return r.rows.map(x=>({id:String(x.id),tanggal:date(x.tanggal),bahan:bahanName(x),jenis:x.jenis,jumlah:num(x.jumlah),satuan:x.satuan,keterangan:x.keterangan}));
}
export async function createStok(d:any,userId:string) {
 if(!['Masuk','Keluar'].includes(d.jenis)||!(Number(d.jumlah)>0)) throw new ValidationError('Data transaksi stok tidak valid.');
 return transaction(async c=>{
  const b=await byName(c,d.bahan);
  const delta=d.jenis==='Masuk'?Number(d.jumlah):-Number(d.jumlah);
  const up=await c.query('UPDATE bahan SET stok=stok+$1 WHERE id=$2 AND stok+$1>=0 RETURNING *',[delta,b.id]);
  if(!up.rowCount) throw new ValidationError(`Stok ${String(d.bahan).toLowerCase()} tidak mencukupi.`);
  const ins=await c.query(`INSERT INTO stok_transaksi(bahan_id,jenis,jumlah,satuan,keterangan,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[b.id,d.jenis,d.jumlah,d.satuan||b.satuan,d.keterangan||'',userId==='demo-user'?null:userId]);
  return {id:String(ins.rows[0].id),tanggal:date(ins.rows[0].tanggal),bahan:b.nama,jenis:d.jenis,jumlah:num(d.jumlah),satuan:d.satuan||b.satuan,keterangan:d.keterangan||''};
 });
}
export async function listPengajuan(){const r=await pool.query(`SELECT p.*,b.nama bahan_nama FROM pengajuan_bahan p JOIN bahan b ON b.id=p.bahan_id ORDER BY p.tanggal DESC,p.created_at DESC`);return r.rows.map(x=>({id:String(x.id),kode:x.kode,tanggal:date(x.tanggal),bahan:x.bahan_nama,jumlah:num(x.jumlah),satuan:x.satuan,tanggalKebutuhan:x.tanggal_kebutuhan?date(x.tanggal_kebutuhan):null,alasan:x.alasan,status:x.status}));}
export async function createPengajuan(d:any,userId:string){const b=await byName(pool,d.bahan);const r=await pool.query(`INSERT INTO pengajuan_bahan(bahan_id,jumlah,satuan,tanggal_kebutuhan,alasan,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[b.id,d.jumlah,d.satuan||b.satuan,d.tanggalKebutuhan||null,d.alasan||'',userId==='demo-user'?null:userId]);return {id:String(r.rows[0].id),kode:r.rows[0].kode,tanggal:date(r.rows[0].tanggal),bahan:b.nama,jumlah:num(r.rows[0].jumlah),satuan:r.rows[0].satuan,tanggalKebutuhan:r.rows[0].tanggal_kebutuhan?date(r.rows[0].tanggal_kebutuhan):null,alasan:r.rows[0].alasan,status:r.rows[0].status};}
export async function updatePengajuan(id:string,d:any,userId:string){if(d.status!=='Disetujui')throw new ValidationError('Status pengajuan tidak valid.');const r=await pool.query(`UPDATE pengajuan_bahan SET status='Disetujui',disetujui_oleh=$2 WHERE id=$1 RETURNING *`,[id,userId==='demo-user'?null:userId]);if(!r.rowCount)throw new NotFoundError('Pengajuan tidak ditemukan.');const q=await pool.query('SELECT nama FROM bahan WHERE id=$1',[r.rows[0].bahan_id]);return {id:String(r.rows[0].id),kode:r.rows[0].kode,tanggal:date(r.rows[0].tanggal),bahan:q.rows[0].nama,jumlah:num(r.rows[0].jumlah),satuan:r.rows[0].satuan,tanggalKebutuhan:r.rows[0].tanggal_kebutuhan?date(r.rows[0].tanggal_kebutuhan):null,alasan:r.rows[0].alasan,status:r.rows[0].status};}
export async function listPengembalian(){const r=await pool.query(`SELECT p.*,b.nama bahan_nama FROM pengembalian_bahan p JOIN bahan b ON b.id=p.bahan_id ORDER BY p.tanggal DESC,p.created_at DESC`);return r.rows.map(x=>({id:String(x.id),tanggal:date(x.tanggal),bahan:x.bahan_nama,jumlah:num(x.jumlah),satuan:x.satuan,kondisi:x.kondisi,alasan:x.alasan,status:x.status}));}
export async function createPengembalian(d:any,userId:string){const map:any={'Layak digunakan':'Diterima','Perlu diperiksa':'Pemeriksaan','Tidak layak':'Dipisahkan'};const status=map[d.kondisi];if(!status||!(Number(d.jumlah)>0))throw new ValidationError('Data pengembalian tidak valid.');return transaction(async c=>{const b=await byName(c,d.bahan);const r=await c.query(`INSERT INTO pengembalian_bahan(bahan_id,jumlah,satuan,kondisi,alasan,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[b.id,d.jumlah,d.satuan||b.satuan,d.kondisi,d.alasan||'',status,userId==='demo-user'?null:userId]);if(status==='Diterima')await c.query('UPDATE bahan SET stok=stok+$1 WHERE id=$2',[d.jumlah,b.id]);return {id:String(r.rows[0].id),tanggal:date(r.rows[0].tanggal),bahan:b.nama,jumlah:num(r.rows[0].jumlah),satuan:r.rows[0].satuan,kondisi:r.rows[0].kondisi,alasan:r.rows[0].alasan,status};});}
export async function getPersiapan(tanggal?:string){
  // Satu round-trip: hitung porsi per slot, upsert, lalu kembalikan barisnya.
  const r = await pool.query(`
    WITH d AS (
      SELECT coalesce($1::date, (now() AT TIME ZONE 'Asia/Jakarta')::date) AS day
    ),
    counts AS (
      SELECT s.waktu,
             count(DISTINCT r.id)::int AS n
      FROM unnest($2::text[]) AS s(waktu)
      LEFT JOIN rekomendasi_menu r
        ON r.waktu = s.waktu AND r.tanggal = (SELECT day FROM d)
       AND r.status = 'Dikirim' AND r.deleted_at IS NULL
      LEFT JOIN pasien p ON p.id = r.pasien_id AND p.deleted_at IS NULL
      WHERE r.id IS NULL OR p.id IS NOT NULL
      GROUP BY s.waktu
    ),
    upsert AS (
      INSERT INTO persiapan_dapur(tanggal, waktu, porsi, status, progres)
      SELECT (SELECT day FROM d), c.waktu, c.n, 'Menunggu', 0 FROM counts c
      ON CONFLICT (tanggal, waktu) DO UPDATE SET porsi = EXCLUDED.porsi
      RETURNING tanggal, waktu, porsi, status, progres, catatan
    )
    SELECT waktu, porsi, status, progres, catatan FROM upsert
    ORDER BY array_position($2::text[], waktu)`, [tanggal || null, slots]);
  return r.rows.map((x:any)=>({waktu:x.waktu,porsi:num(x.porsi),status:x.status,progres:num(x.progres),catatan:x.catatan}));
}
export async function reserveKitchenStock(db:any,tanggal:string,waktu:string,menus:{menu:string;porsi:number}[]){const existing=await db.query(`SELECT menu,bahan_id,jumlah FROM persiapan_bahan_reservasi WHERE tanggal=$1 AND waktu=$2 AND status='Aktif' FOR UPDATE`,[tanggal,waktu]);if(existing.rows.length)return existing.rows;const totals=new Map<string,any>();for(const item of menus){let result=await db.query(`SELECT r.menu,r.bahan_id,b.nama AS bahan,r.jumlah_per_porsi,r.satuan,b.stok,b.satuan AS stok_satuan,b.kedaluwarsa FROM menu_resep_bahan r JOIN bahan b ON b.id=r.bahan_id WHERE lower(r.menu)=lower($1) AND b.deleted_at IS NULL FOR UPDATE OF b`,[item.menu]);if(!result.rows.length){result=await db.query(`SELECT mrb.menu,mrb.bahan_id,b.nama AS bahan,mrb.jumlah_per_porsi,mrb.satuan,b.stok,b.satuan AS stok_satuan,b.kedaluwarsa FROM menu_paket mp JOIN menu_paket_resep mpr ON mpr.paket_id=mp.id JOIN menu_resep_bahan mrb ON lower(mrb.menu)=lower(mpr.resep_nama) JOIN bahan b ON b.id=mrb.bahan_id WHERE lower(mp.nama)=lower($1) AND b.deleted_at IS NULL FOR UPDATE OF b`,[item.menu]);}if(!result.rows.length)continue;for(const row of result.rows){const rSat=String(row.satuan||'').trim().toLowerCase();const sSat=String(row.stok_satuan||'').trim().toLowerCase();let factor=1;if(rSat===sSat){factor=1;}else if(rSat==='gram'&&sSat==='kg'){factor=0.001;}else if(rSat==='kg'&&sSat==='gram'){factor=1000;}else if(rSat==='ons'&&sSat==='kg'){factor=0.1;}else if(rSat==='kg'&&sSat==='ons'){factor=10;}else if(rSat==='ml'&&sSat==='liter'){factor=0.001;}else if(rSat==='liter'&&sSat==='ml'){factor=1000;}else if(rSat==='sdm'&&(sSat==='kg'||sSat==='liter')){factor=0.015;}else if(rSat==='sdm'&&(sSat==='gram'||sSat==='ml')){factor=15;}else if(rSat==='sdt'&&(sSat==='kg'||sSat==='liter')){factor=0.005;}else if(rSat==='sdt'&&(sSat==='gram'||sSat==='ml')){factor=5;}if(bahanStatus({kedaluwarsa:row.kedaluwarsa,stok:num(row.stok),minimum:0})==='Kedaluwarsa')throw new ValidationError(`${row.bahan} sudah kedaluwarsa.`);const q=Number(row.jumlah_per_porsi)*Number(item.porsi)*factor;if(!Number.isFinite(q)||q<=0)throw new ValidationError(`Jumlah resep bahan ${row.bahan} harus lebih dari 0.`);const key=String(row.bahan_id);const old=totals.get(key);totals.set(key,{...row,required:Math.round(((old?.required||0)+q)*10000)/10000});}}for(const row of totals.values()){const required=row.required;const available=num(row.stok);if(required>available+1e-9)throw new ValidationError(`${row.bahan}: butuh ${required} ${row.stok_satuan}; stok ${available} ${row.stok_satuan}.`);}const created=[];for(const row of totals.values()){const update=await db.query(`UPDATE bahan SET stok=stok-$1 WHERE id=$2 AND stok >= $1 RETURNING id`,[row.required,row.bahan_id]);if(!update.rowCount)throw new ValidationError(`Stok ${row.bahan} tidak mencukupi.`);const ledger=await db.query(`INSERT INTO stok_transaksi(tanggal,bahan_id,jenis,jumlah,satuan,keterangan) VALUES($1,$2,'Keluar',$3,$4,$5) RETURNING id`,[tanggal,row.bahan_id,row.required,row.stok_satuan,`Pemakaian dapur ${waktu}`]);const res=await db.query(`INSERT INTO persiapan_bahan_reservasi(tanggal,waktu,menu,bahan_id,jumlah,stok_transaksi_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,[tanggal,waktu,row.menu,row.bahan_id,row.required,ledger.rows[0].id]);created.push(res.rows[0]);}return created;}
async function completeKitchenSlot(waktu:string,day:string,d:any){const result=await transaction(async c=>{await c.query(`SELECT id FROM persiapan_dapur WHERE tanggal=$1 AND waktu=$2 FOR UPDATE`,[day,waktu]);const ready=await c.query(`SELECT r.menu,count(DISTINCT r.id)::int porsi FROM rekomendasi_menu r JOIN pasien p ON p.id=r.pasien_id AND p.deleted_at IS NULL WHERE r.waktu=$1 AND r.tanggal=$2 AND r.status='Dikirim' AND r.deleted_at IS NULL GROUP BY r.menu`,[waktu,day]);if(!ready.rows.length)throw new ValidationError('Tidak ada rekomendasi terkirim untuk slot ini.');await reserveKitchenStock(c,day,waktu,ready.rows);const r=await c.query(`UPDATE persiapan_dapur SET status='Selesai',progres=100 WHERE tanggal=$1 AND waktu=$2 RETURNING *`,[day,waktu]);if(!r.rowCount)throw new NotFoundError('Slot persiapan tidak ditemukan.');const x=r.rows[0];return {waktu:x.waktu,porsi:num(x.porsi),status:x.status,progres:num(x.progres),catatan:x.catatan};});void import('../routes/push.js').then(async ({ sendPushToRole }) => {
  const siap = await pool.query(
    `SELECT r.menu, count(DISTINCT r.id)::int AS porsi
     FROM rekomendasi_menu r JOIN pasien p ON p.id = r.pasien_id AND p.deleted_at IS NULL
     WHERE r.waktu=$1 AND r.tanggal=$2 AND r.status='Dikirim' AND r.deleted_at IS NULL
     GROUP BY r.menu ORDER BY r.menu`,
    [waktu, day]
  );
  const items = siap.rows.map((r: any) => ({ judul: String(r.menu), nilai: `${r.porsi} porsi` }));
  const total = siap.rows.reduce((sum: number, r: any) => sum + Number(r.porsi || 0), 0);
  await sendPushToRole(
    ['waiter', 'ahli-gizi'],
    'Makanan siap didistribusikan',
    `${waktu} · ${total} porsi siap diantar`,
    {
      roleLinks: { waiter: '/pages/waiter.html#distribusi', 'ahli-gizi': '/pages/ahli-gizi.html#jadwal' },
      detail: {
        kind: 'dapur',
        ringkas: `Dapur menyelesaikan persiapan ${waktu} untuk ${day}.`,
        fields: [
          { label: 'Tanggal', value: formatTanggalId(day) },
          { label: 'Waktu makan', value: String(waktu) },
          { label: 'Total porsi', value: `${total} porsi` },
          { label: 'Status dapur', value: 'Selesai' },
        ],
        items,
      },
    }
  );
}).catch(()=>{});return result;}
export async function patchPersiapan(waktu:string,d:any){if(!slots.includes(waktu))throw new NotFoundError('Slot persiapan tidak ditemukan.');if(d.status!==undefined&&!['Menunggu','Diproses','Selesai'].includes(d.status))throw new ValidationError('Status persiapan tidak valid.');if(d.progres!==undefined&&(!Number.isFinite(Number(d.progres))||Number(d.progres)<0||Number(d.progres)>100))throw new ValidationError('Progres persiapan harus 0 sampai 100.');const day=d.tanggal||date((await pool.query(`SELECT ${todaySql} d`)).rows[0].d);if(d.status==='Selesai')return completeKitchenSlot(waktu,day,d);const allowed=['porsi','status','progres','catatan'];const sets:string[]=[];const vals:any[]=[];for(const k of allowed)if(d[k]!==undefined){sets.push(`${k}=$${vals.length+1}`);vals.push(d[k]);}if(d.status==='Selesai'&&d.progres===undefined){sets.push(`progres=$${vals.length+1}`);vals.push(100);}if(!sets.length)throw new ValidationError('Tidak ada field yang diubah.');vals.push(day,waktu);const r=await pool.query(`UPDATE persiapan_dapur SET ${sets.join(',')} WHERE tanggal=$${vals.length-1} AND waktu=$${vals.length} RETURNING *`,vals);if(!r.rowCount)throw new NotFoundError('Slot persiapan tidak ditemukan.');const x=r.rows[0];return {waktu:x.waktu,porsi:num(x.porsi),status:x.status,progres:num(x.progres),catatan:x.catatan};}
export async function listMenuRecipes(){const r=await pool.query(`SELECT r.id,r.menu,b.id bahan_id,b.nama bahan,r.jumlah_per_porsi,r.satuan,r.kalori_per_porsi FROM menu_resep_bahan r JOIN bahan b ON b.id=r.bahan_id WHERE b.deleted_at IS NULL ORDER BY lower(r.menu),b.nama`);return r.rows.map(x=>({id:String(x.id),menu:x.menu,bahanId:String(x.bahan_id),bahan:x.bahan,jumlahPerPorsi:num(x.jumlah_per_porsi),satuan:x.satuan,kaloriPerPorsi:num(x.kalori_per_porsi)}));}
export async function replaceMenuRecipe(menu:string,items:any[]){const name=String(menu||'').trim();if(!name||!Array.isArray(items)||!items.length)throw new ValidationError('Nama menu dan minimal satu bahan resep wajib diisi.');const seen=new Set<string>();for(const item of items){const id=String(item.bahanId||'');const q=Number(item.jumlahPerPorsi);const k=Number(item.kaloriPerPorsi??0);if(!id||!Number.isFinite(q)||q<=0)throw new ValidationError('Setiap bahan resep harus dipilih dan memiliki jumlah per porsi lebih dari nol.');if(!Number.isFinite(k)||k<0)throw new ValidationError('Kalori per porsi tidak boleh negatif.');if(seen.has(id))throw new ValidationError('Bahan tidak boleh berulang dalam satu resep.');seen.add(id);}return transaction(async c=>{const selected=await c.query(`SELECT id,nama,satuan FROM bahan WHERE id=ANY($1::uuid[]) AND deleted_at IS NULL FOR SHARE`,[[...seen]]);if(selected.rows.length!==seen.size)throw new ValidationError('Salah satu bahan resep tidak ditemukan atau sudah dihapus.');await c.query(`DELETE FROM menu_resep_bahan WHERE lower(menu)=lower($1)`,[name]);const byId=new Map(selected.rows.map((b:any)=>[String(b.id),b]));const out=[];for(const item of items){const b:any=byId.get(String(item.bahanId));const satuan=String(item.satuan||b.satuan||'').trim()||b.satuan;const r=await c.query(`INSERT INTO menu_resep_bahan(menu,bahan_id,jumlah_per_porsi,satuan,kalori_per_porsi) VALUES($1,$2,$3,$4,$5) RETURNING id`,[name,b.id,Number(item.jumlahPerPorsi),satuan,Number(item.kaloriPerPorsi??0)]);out.push({id:String(r.rows[0].id),menu:name,bahanId:String(b.id),bahan:b.nama,jumlahPerPorsi:Number(item.jumlahPerPorsi),satuan:satuan,kaloriPerPorsi:Number(item.kaloriPerPorsi??0)});}return out;});}
export async function deleteMenuRecipe(menu:string){const name=String(menu||'').trim();if(!name)throw new ValidationError('Nama menu wajib diisi.');const r=await pool.query(`DELETE FROM menu_resep_bahan WHERE lower(menu)=lower($1) RETURNING id`,[name]);if(!r.rowCount)throw new ValidationError('Resep tidak ditemukan.');return {menu:name,deleted:r.rowCount};}
export async function ringkasan(){
  // Satu round-trip: hitungan + daftar bahan diambil sekaligus.
  const r = await pool.query(`SELECT
      (SELECT count(*)::int FROM bahan WHERE deleted_at IS NULL) jenis,
      (SELECT count(*)::int FROM pengajuan_bahan WHERE status='Menunggu') pengajuan,
      (SELECT count(*)::int FROM pengembalian_bahan WHERE status IN ('Pemeriksaan','Dipisahkan')) pengembalian,
      (SELECT coalesce(json_agg(json_build_object('stok',stok,'minimum',minimum,'kedaluwarsa',kedaluwarsa)),'[]'::json)
         FROM bahan WHERE deleted_at IS NULL) bahan`);
  const row:any = r.rows[0];
  const stats = {aman:0,periksa:0,menipis:0,habis:0,kedaluwarsa:0};
  for(const b of row.bahan || []){
    const s = bahanStatus({kedaluwarsa: b.kedaluwarsa ? date(b.kedaluwarsa) : null, stok:num(b.stok), minimum:num(b.minimum)}).toLowerCase();
    stats[s as keyof typeof stats]++;
  }
  return {jenisBahan:row.jenis, stokMenipis:stats.menipis+stats.habis, pengajuanAktif:row.pengajuan, pengembalian:row.pengembalian};
}
export async function kondisiStok(){const rows=(await pool.query('SELECT stok,minimum,kedaluwarsa FROM bahan WHERE deleted_at IS NULL')).rows;const out:any={aman:0,periksa:0,menipis:0,habis:0,kedaluwarsa:0};for(const b of rows)out[bahanStatus({kedaluwarsa:date(b.kedaluwarsa),stok:num(b.stok),minimum:num(b.minimum)}).toLowerCase()]++;const total=rows.length;return Object.fromEntries(Object.entries(out).map(([k,n])=>[k,{jumlah:n,persen:total?Math.round((Number(n)/total)*100):0}]));}
export async function pemakaian(){const r=await pool.query(`SELECT to_char(d,'Dy') label,COALESCE(sum(s.jumlah),0)::numeric jumlah FROM generate_series(${todaySql}-6,${todaySql},'1 day') d LEFT JOIN stok_transaksi s ON s.tanggal=d AND s.jenis='Keluar' GROUP BY d ORDER BY d`);const hari=r.rows.map(x=>({label:x.label.trim(),jumlah:num(x.jumlah)}));return {hari,total:hari.reduce((a,x)=>a+x.jumlah,0)};}

// ── Menu Paket ──────────────────────────────────────────────────────────────
export async function listMenuPaket() {
  const r = await pool.query(`
    SELECT mp.id, mp.nama, mp.deskripsi, mp.diet, mp.tekstur, mp.created_at, mp.updated_at,
      COALESCE(
        json_agg(
          json_build_object('resep', mpr.resep_nama, 'kalori',
            (SELECT COALESCE(SUM(kalori_per_porsi),0) FROM menu_resep_bahan WHERE lower(menu)=lower(mpr.resep_nama))
          ) ORDER BY mpr.resep_nama
        ) FILTER (WHERE mpr.id IS NOT NULL),
        '[]'::json
      ) AS resep_list,
      COALESCE((
        SELECT SUM(sub.k) FROM (
          SELECT COALESCE(SUM(kalori_per_porsi),0) k
          FROM menu_paket_resep x2
          JOIN menu_resep_bahan mrb ON lower(mrb.menu)=lower(x2.resep_nama)
          WHERE x2.paket_id=mp.id
          GROUP BY x2.resep_nama
        ) sub
      ),0) AS total_kalori
    FROM menu_paket mp
    LEFT JOIN menu_paket_resep mpr ON mpr.paket_id = mp.id
    GROUP BY mp.id, mp.nama, mp.deskripsi, mp.diet, mp.tekstur, mp.created_at, mp.updated_at
    ORDER BY mp.nama`);
  return r.rows.map(x => ({
    id: String(x.id),
    nama: x.nama,
    deskripsi: x.deskripsi || '',
    diet: x.diet,
    tekstur: x.tekstur,
    totalKalori: num(x.total_kalori),
    resepList: Array.isArray(x.resep_list) ? x.resep_list : (typeof x.resep_list === 'string' ? JSON.parse(x.resep_list) : []),
  }));
}

export async function createMenuPaket(d: any) {
  const nama = String(d.nama || '').trim();
  const deskripsi = String(d.deskripsi || '').trim();
  const diet = String(d.diet || '').trim();
  const tekstur = String(d.tekstur || '').trim();
  if (!['Diet Normal', 'Diet Diabetes', 'Diet Rendah Garam', 'Diet Khusus'].includes(diet)) throw new ValidationError('Diet menu paket tidak valid.');
  if (!['Biasa', 'Lunak', 'Bubur', 'Cair'].includes(tekstur)) throw new ValidationError('Tekstur menu paket tidak valid.');
  const resepList: string[] = Array.isArray(d.resepList) ? d.resepList.map((s: any) => String(s).trim()).filter(Boolean) : [];
  if (!nama) throw new ValidationError('Nama menu paket wajib diisi.');
  if (!resepList.length) throw new ValidationError('Menu paket harus memiliki minimal satu resep.');
  return transaction(async c => {
    // Validasi semua nama resep ada di menu_resep_bahan
    for (const resep of resepList) {
      const chk = await c.query(`SELECT 1 FROM menu_resep_bahan WHERE lower(menu)=lower($1) LIMIT 1`, [resep]);
      if (!chk.rowCount) throw new ValidationError(`Resep "${resep}" belum dikonfigurasi. Buat resepnya terlebih dahulu.`);
    }
    const ins = await c.query(
      `INSERT INTO menu_paket(nama,deskripsi,diet,tekstur) VALUES($1,$2,$3,$4) RETURNING id,nama,deskripsi,diet,tekstur,created_at`,
            [nama, deskripsi, diet, tekstur]
    );
    const paketId = ins.rows[0].id;
    for (const resep of resepList) {
      await c.query(`INSERT INTO menu_paket_resep(paket_id,resep_nama) VALUES($1,$2)`, [paketId, resep]);
    }
    // Hitung kalori total
    const kal = await c.query(
      `SELECT COALESCE(SUM(sub.k),0) total FROM (
         SELECT COALESCE(SUM(kalori_per_porsi),0) k
         FROM menu_resep_bahan WHERE lower(menu)=ANY($1::text[])
         GROUP BY lower(menu)
       ) sub`,
      [resepList.map(s => s.toLowerCase())]
    );
    return {
      id: String(paketId),
      nama: ins.rows[0].nama,
      deskripsi: ins.rows[0].deskripsi,
      diet,
      tekstur,
      totalKalori: num(kal.rows[0].total),
      resepList: resepList.map(r => ({ resep: r, kalori: 0 })),
    };
  });
}

export async function updateMenuPaket(id: string, d: any) {
  const nama = String(d.nama || '').trim();
  const deskripsi = String(d.deskripsi ?? '').trim();
  const diet = String(d.diet || '').trim();
  const tekstur = String(d.tekstur || '').trim();
  if (!['Diet Normal', 'Diet Diabetes', 'Diet Rendah Garam', 'Diet Khusus'].includes(diet)) throw new ValidationError('Diet menu paket tidak valid.');
  if (!['Biasa', 'Lunak', 'Bubur', 'Cair'].includes(tekstur)) throw new ValidationError('Tekstur menu paket tidak valid.');
  const resepList: string[] = Array.isArray(d.resepList) ? d.resepList.map((s: any) => String(s).trim()).filter(Boolean) : [];
  if (!nama) throw new ValidationError('Nama menu paket wajib diisi.');
  if (!resepList.length) throw new ValidationError('Menu paket harus memiliki minimal satu resep.');
  return transaction(async c => {
    for (const resep of resepList) {
      const chk = await c.query(`SELECT 1 FROM menu_resep_bahan WHERE lower(menu)=lower($1) LIMIT 1`, [resep]);
      if (!chk.rowCount) throw new ValidationError(`Resep "${resep}" belum dikonfigurasi.`);
    }
    const upd = await c.query(
      `UPDATE menu_paket SET nama=$1,deskripsi=$2,diet=$3,tekstur=$4,updated_at=now() WHERE id=$5 RETURNING id,nama,deskripsi,diet,tekstur`,
            [nama, deskripsi, diet, tekstur, id]
    );
    if (!upd.rowCount) throw new NotFoundError('Menu paket tidak ditemukan.');
    await c.query(`DELETE FROM menu_paket_resep WHERE paket_id=$1`, [id]);
    for (const resep of resepList) {
      await c.query(`INSERT INTO menu_paket_resep(paket_id,resep_nama) VALUES($1,$2)`, [id, resep]);
    }
    const kal = await c.query(
      `SELECT COALESCE(SUM(sub.k),0) total FROM (
         SELECT COALESCE(SUM(kalori_per_porsi),0) k
         FROM menu_resep_bahan WHERE lower(menu)=ANY($1::text[])
         GROUP BY lower(menu)
       ) sub`,
      [resepList.map(s => s.toLowerCase())]
    );
    return {
      id: String(id),
      nama: upd.rows[0].nama,
      deskripsi: upd.rows[0].deskripsi,
      diet,
      tekstur,
      totalKalori: num(kal.rows[0].total),
      resepList: resepList.map(r => ({ resep: r, kalori: 0 })),
    };
  });
}

export async function deleteMenuPaket(id: string) {
  const r = await pool.query(`DELETE FROM menu_paket WHERE id=$1 RETURNING nama`, [id]);
  if (!r.rowCount) throw new NotFoundError('Menu paket tidak ditemukan.');
  return { id, nama: r.rows[0].nama, deleted: true };
}
