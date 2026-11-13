import { useState } from 'react'

import { SelectField } from '@/components/onboarding/controls'
import { PickerSheet } from '@/components/settings/picker-sheet'
import type { ProfileData } from '@/shared/settings'

type District = ProfileData['districts'][number]

/** Райони міста — лише ті, що в базі (зараз — Одеса). */
export function cityDistricts(all: District[], city: string): District[] {
  return all.filter((d) => d.citySlug === city)
}

/**
 * Місто й район — два поля-вибори з аркушем списку, як у формі профілю
 * (settings/profile). Район — лише там, де для міста є райони; інше
 * місто скидає район (район іншого міста тут нічого не означає).
 */
export function PlaceFields({
  cities,
  districts: all,
  city,
  district,
  onChange,
  cityError,
  districtError,
}: {
  cities: ProfileData['cities']
  districts: District[]
  city: string
  district: string
  onChange: (next: { city: string; district: string }) => void
  cityError?: string | null
  districtError?: string | null
}) {
  const [picker, setPicker] = useState<'city' | 'district' | null>(null)
  const districts = cityDistricts(all, city)
  const cityName = cities.find((x) => x.slug === city)?.name ?? ''
  const districtName = districts.find((d) => d.slug === district)?.name ?? ''

  const groups = [
    {
      title: 'Місто',
      options: districts
        .filter((d) => d.group === 'CITY')
        .map((d) => ({ value: d.slug, label: d.name })),
    },
    {
      title: 'Передмістя',
      options: districts
        .filter((d) => d.group === 'SUBURB')
        .map((d) => ({ value: d.slug, label: d.name })),
    },
  ].filter((g) => g.options.length > 0)

  return (
    <>
      <SelectField
        label="Місто"
        value={cityName}
        onPress={() => setPicker('city')}
        error={cityError}
      />
      {districts.length > 0 ? (
        <SelectField
          label="Район"
          value={districtName}
          onPress={() => setPicker('district')}
          error={districtError}
        />
      ) : null}

      <PickerSheet
        visible={picker === 'city'}
        title="Місто"
        searchable
        groups={[
          { options: cities.map((x) => ({ value: x.slug, label: x.name })) },
        ]}
        value={city}
        onPick={(slug) => {
          const keep = all.some(
            (d) => d.citySlug === slug && d.slug === district,
          )
          onChange({ city: slug, district: keep ? district : '' })
        }}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'district'}
        title="Район"
        groups={groups}
        value={district}
        onPick={(slug) => onChange({ city, district: slug })}
        onClose={() => setPicker(null)}
      />
    </>
  )
}
