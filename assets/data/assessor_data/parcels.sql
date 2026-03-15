Select Distinct
Case
  When pm.neighborhood >= 9000 Then 'Manufactured_Homes'
  When pm.neighborhood >= 6003 Then 'District_6'
  When pm.neighborhood = 6002 Then 'Manufactured_Homes'
  When pm.neighborhood = 6001 Then 'District_6'
  When pm.neighborhood = 6000 Then 'Manufactured_Homes'
  When pm.neighborhood >= 5003 Then 'District_5'
  When pm.neighborhood = 5002 Then 'Manufactured_Homes'
  When pm.neighborhood = 5001 Then 'District_5'
  When pm.neighborhood = 5000 Then 'Manufactured_Homes'
  When pm.neighborhood >= 4000 Then 'District_4'
  When pm.neighborhood >= 3000 Then 'District_3'
  When pm.neighborhood >= 2000 Then 'District_2'
  When pm.neighborhood >= 1021 Then 'District_1'
  When pm.neighborhood = 1020 Then 'Manufactured_Homes'
  When pm.neighborhood >= 1001 Then 'District_1'
  When pm.neighborhood = 1000 Then 'Manufactured_Homes'
  When pm.neighborhood >= 451 Then 'Commercial'
  When pm.neighborhood = 450 Then 'Specialized_Cell_Towers'
  When pm.neighborhood >= 1 Then 'Commercial'
  When pm.neighborhood = 0 Then 'Other (PP, OP, NA, Error)'
  Else Null
End As District,
pm.neighborhood As GEO,
Trim(pm.NeighborHoodName) As GEO_Name,
pm.lrsn,
Trim(pm.pin) As PIN,
Trim(pm.AIN) As AIN,
Case
  When pm.pin Like 'A%' Then 'Athol' -- Athol
  When pm.pin Like 'C%' Then 'CoeurdAlene' -- Coeur d'Alene
  When pm.pin Like 'D%' Then 'Dalton_Gardens' -- Dalton Gardens
  When pm.pin Like 'H%' Then 'Hayden' -- Hayden
  When pm.pin Like 'V%' Then 'Hayden_Lake' -- Hayden Lake
  When pm.pin Like 'P%' Then 'Post_Falls' -- Post Falls
  When pm.pin Like 'R%' Then 'Rathdrum' -- Rathdrum
  When pm.pin Like 'S%' Then 'Spirit_Lake' -- Spirit Lake
  When pm.pin Like 'X%' Then 'Hauser' -- Hauser
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
End As PIN_City,
pm.ClassCD,
Trim(pm.PropClassDescr) As Property_Class_Description,
pm.EffStatus

From parceltableview As pm

Where pm.EffStatus = 'A'
