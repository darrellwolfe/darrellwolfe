Select
lh.RevObjId As lrsn,
Case
  When pmd.neighborhood >= 9000 Then 'Manufactured Homes'
  When pmd.neighborhood >= 6003 Then 'District 6'
  When pmd.neighborhood = 6002 Then 'Manufactured Homes'
  When pmd.neighborhood = 6001 Then 'District 6'
  When pmd.neighborhood = 6000 Then 'Manufactured Homes'
  When pmd.neighborhood >= 5003 Then 'District 5'
  When pmd.neighborhood = 5002 Then 'Manufactured Homes'
  When pmd.neighborhood = 5001 Then 'District 5'
  When pmd.neighborhood = 5000 Then 'Manufactured Homes'
  When pmd.neighborhood >= 4000 Then 'District 4'
  When pmd.neighborhood >= 3000 Then 'District 3'
  When pmd.neighborhood >= 2000 Then 'District 2'
  When pmd.neighborhood >= 1021 Then 'District 1'
  When pmd.neighborhood = 1020 Then 'Manufactured Homes'
  When pmd.neighborhood >= 1001 Then 'District 1'
  When pmd.neighborhood = 1000 Then 'Manufactured Homes'
  When pmd.neighborhood >= 451 Then 'Commercial'
  When pmd.neighborhood = 450 Then 'Personal Property'
  When pmd.neighborhood >= 1 Then 'Commercial'
  When pmd.neighborhood = 0 Then 'PP_N/A or Error'
  Else Null
End As District,
pmd.neighborhood As GEO,
Trim(pmd.NeighborHoodName) As GEO_Name,
Case
  When pmd.pin Like 'A%' Then 'Athol' -- Athol
  When pmd.pin Like 'C%' Then 'CoeurdAlene' -- Coeur d'Alene
  When pmd.pin Like 'D%' Then 'Dalton_Gardens' -- Dalton Gardens
  When pmd.pin Like 'H%' Then 'Hayden' -- Hayden
  When pmd.pin Like 'V%' Then 'Hayden_Lake' -- Hayden Lake
  When pmd.pin Like 'P%' Then 'Post_Falls' -- Post Falls
  When pmd.pin Like 'R%' Then 'Rathdrum' -- Rathdrum
  When pmd.pin Like 'S%' Then 'Spirit_Lake' -- Spirit Lake
  When pmd.pin Like 'X%' Then 'Hauser' -- Hauser
  When pmd.pin Like 'F%' Then 'Fernan Lake Village'
  When pmd.pin Like 'B%' Then 'Bayview'
  When pmd.pin Like 'T%' Then 'Stateline'
  When pmd.pin Like 'U%' Then 'Huetter'
  When pmd.pin Like 'W%' Then 'Worley'
  When pmd.pin Like 'Y%' Then 'Harrison'
  When pmd.pin Like 'E%' Then 'Business Personal Property'
  When pmd.pin Like 'G%' Then 'Cable TV'
  When pmd.pin Like 'KC-%' Then 'Test Parcels'
  When pmd.pin Like 'M%' Then 'Mobile Homes'
  When pmd.pin Like '0%' Then 'Kootenai County'
  When pmd.pin Like '5%' Then 'Kootenai County'
  When pmd.pin Like '4%' Then 'Kootenai County'
  When pmd.pin Like 'UP%' Then 'Operating Property'
  When pmd.pin Like 'L%' Then 'Float Homes'
  Else 'UNKNOWN'
End As PIN_City,
Trim(pmd.pin) As PIN,
Trim(pmd.AIN) As AIN,
lh.TotalMktValue,
ld.lcm,
Trim(lcm.tbl_element_desc) As LandMethod,
ld.LandType As LandTypeNum,
lt.land_type_desc As LandType,
-- String_Agg(lt.land_type_desc, ', ') As AggregatedLandTypes,
ld.LandDetailType,
ld.SiteRating,
sr.tbl_element_desc As Legend,
ld.BaseRate,
ld.SoilIdent,
ld.LDAcres,
ld.ActualFrontage,
ld.DepthFactor,
ld.SoilProdFactor,
ld.SmallAcreFactor

-- Land Header
From LandHeader As lh
-- Land Detail
Join LandDetail As ld On lh.id = ld.LandHeaderId
  And ld.EffStatus = 'A'
  And lh.PostingSource = ld.PostingSource
-- Land Types
Left Join land_types As lt On ld.LandType = lt.land_type
Left Join codes_table As lcm On Cast(lcm.tbl_element As Int) = ld.lcm
  And lcm.code_status = 'A'
  And lcm.tbl_type_code = 'lcmshortdesc'
  -- 'lcmshortdesc' (aka Land Types)
Left Join codes_table As sr On sr.tbl_element = ld.SiteRating
  And sr.code_status = 'A'
  And sr.tbl_type_code = 'siterating'
  -- 'siterating' (aka Legends)
Join parceltableview As pmd On lh.RevObjId = pmd.lrsn
  And pmd.EffStatus = 'A'
  And pmd.neighborhood <> 0

Where lh.EffStatus = 'A'
  And lh.PostingSource = 'A'
  And ld.PostingSource = 'A'
