import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cityCoord, normCityName, resolveProvince, resolveStoreLocation } from '../src/data/geoMeta.ts'

const source = JSON.parse(readFileSync(new URL('../src/data/source1.json', import.meta.url), 'utf8'))
const stores = source.stores.filter(row => row.city && row.status)

test('14 workbook cities, including names ending in 州, resolve to their own provinces', () => {
  const cities = [...new Set(stores.map(row => row.city.replace(/市$/, '')))]
  assert.equal(cities.length, 14)
  cities.forEach(city => {
    assert.ok(resolveProvince(city), city)
    assert.equal(normCityName(city), `${city}市`)
  })
  assert.equal(resolveProvince('苏州').key, 'jiangsu')
  assert.equal(resolveProvince('郑州').key, 'henan')
  assert.notDeepEqual(cityCoord('苏州'), cityCoord('杭州'))
  assert.equal(normCityName('昆山'), '苏州市')
  assert.equal(normCityName('姜堰'), '泰州市')
})

test('all 32 stores have addresses; coarse coordinates remain explicitly unverified', () => {
  assert.equal(stores.length, 32)
  assert.equal(stores.filter(row => row.status === '已营业').length, 19)
  for (const store of stores) {
    assert.ok(store.address, store.name)
    const location = resolveStoreLocation(store.name, store.city, 0, store.address)
    assert.equal(location.precision, 'address-approx', store.name)
    const [lng, lat] = location.coord
    assert.ok(Number.isFinite(lng) && lng > 100 && lng < 130, store.name)
    assert.ok(Number.isFinite(lat) && lat > 20 && lat < 45, store.name)
  }
})

test('unknown/empty store names use city fallback, never arbitrary matching or fabricated spread', () => {
  for (const name of ['', '未匹配测试门店']) {
    const location = resolveStoreLocation(name, '苏州', 7)
    assert.equal(location.precision, 'city-fallback')
    assert.deepEqual(location.coord, cityCoord('苏州'))
  }
})

test('store location action stays in the dashboard; map credit and load fallback remain present', () => {
  const cityMap = readFileSync(new URL('../src/components/boards/CityMap.vue', import.meta.url), 'utf8')
  const streetMap = readFileSync(new URL('../src/components/boards/StoreStreetMap.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(cityMap, /window\.open|uri\.amap\.com|openExternalMap/)
  assert.match(cityMap, /<StoreStreetMap/)
  assert.match(streetMap, /openstreetmap\.org\/copyright/)
  assert.match(streetMap, /tileerror/)
  assert.match(streetMap, /map\?\.remove\(\)/)
})
