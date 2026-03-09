Select Distinct
CASE
  WHEN pm.neighborhood >= 9000 THEN 'Manufactured_Homes'
  WHEN pm.neighborhood >= 6003 THEN 'District_6'
  WHEN pm.neighborhood = 6002 THEN 'Manufactured_Homes'
  WHEN pm.neighborhood = 6001 THEN 'District_6'
  WHEN pm.neighborhood = 6000 THEN 'Manufactured_Homes'
  WHEN pm.neighborhood >= 5003 THEN 'District_5'
  WHEN pm.neighborhood = 5002 THEN 'Manufactured_Homes'
  WHEN pm.neighborhood = 5001 THEN 'District_5'
  WHEN pm.neighborhood = 5000 THEN 'Manufactured_Homes'
  WHEN pm.neighborhood >= 4000 THEN 'District_4'
  WHEN pm.neighborhood >= 3000 THEN 'District_3'
  WHEN pm.neighborhood >= 2000 THEN 'District_2'
  WHEN pm.neighborhood >= 1021 THEN 'District_1'
  WHEN pm.neighborhood = 1020 THEN 'Manufactured_Homes'
  WHEN pm.neighborhood >= 1001 THEN 'District_1'
  WHEN pm.neighborhood = 1000 THEN 'Manufactured_Homes'
  WHEN pm.neighborhood >= 451 THEN 'Commercial'
  WHEN pm.neighborhood = 450 THEN 'Specialized_Cell_Towers'
  WHEN pm.neighborhood >= 1 THEN 'Commercial'
  WHEN pm.neighborhood = 0 THEN 'Other (PP, OP, NA, Error)'
  ELSE NULL
END AS District
,pm.neighborhood AS GEO
,TRIM(pm.NeighborHoodName) AS GEO_Name
,pm.lrsn
,TRIM(pm.pin) AS PIN
,TRIM(pm.AIN) AS AIN
,Case
    When pm.pin Like 'A%' Then 'Athol'         -- Athol
    When pm.pin Like 'C%' Then 'CoeurdAlene'          -- Coeur d’Alene
    When pm.pin Like 'D%' Then 'Dalton_Gardens'         -- Dalton Gardens
    When pm.pin Like 'H%' Then 'Hayden'         -- Hayden
    When pm.pin Like 'V%' Then 'Hayden_Lake'         -- Hayden Lake
    When pm.pin Like 'P%' Then 'Post_Falls'           -- Post Falls
    When pm.pin Like 'R%' Then 'Rathdrum'         -- Rathdrum
    When pm.pin Like 'S%' Then 'Spirit_Lake'         -- Spirit Lake
    When pm.pin Like 'X%' Then 'Hauser'       -- Hauser
    When pm.pin Like 'F%' Then 'Fernan Lake Village'
    When pm.pin Like 'B%' Then 'Bayview'
    When pm.pin Like 'T%' Then 'Stateline'
    When pm.pin Like 'U%' Then 'Huetter'
    When pm.pin Like 'W%' Then 'Worley'
    When pm.pin Like 'Y%' Then 'Harrison'
    When pm.pin Like 'E%' Then 'Business Personal Property'
    When pm.pin Like 'G%' Then 'Cable TV'
    When pm.pin Like 'KC-%' Then 'Test Parcels'
    When pm.pin Like 'M%' Then 'Mobile Homes'
    When pm.pin Like '0%' Then 'Kootenai County'
    When pm.pin Like '5%' Then 'Kootenai County'
    When pm.pin Like '4%' Then 'Kootenai County'
    When pm.pin Like 'UP%' Then 'Operating Property'
    When pm.pin Like 'L%' Then 'Float Homes'
    Else 'UNKNOWN'
End As PIN_City
,pm.ClassCD
,TRIM(pm.PropClassDescr) AS Property_Class_Description
,pm.EffStatus

From parceltableview AS pm
Where pm.EffStatus = 'A'