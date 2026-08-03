Attribute VB_Name = "ImportadorAvaluos"
' =====================================================================
' IMPORTADOR DE AVALÚOS (JSON de la app -> Excel)
' Robusto: ubica cada dato por el NOMBRE del encabezado (fila 1),
' no por columna fija. Si mueves/borras columnas, sigue funcionando.
'
' - ImportarUrbano : solo registros URBANO  -> hoja "Encargos Urbanos"
' - ImportarRural  : solo registros RURAL   -> hoja "Encargos Rurales"
' - CrearBotones   : agrega un botón en cada hoja (ejecútalo una vez)
'
' Lee en UTF-8 (tildes/ñ). Hereda fórmulas y formato de una fila modelo.
' =====================================================================
Option Explicit

' --- Variables de módulo (antes de cualquier procedimiento) ---
Private p As Long
Private js As String

Public Const VERSION_MACRO As String = "v6 - 2026-06-05 (escribe x en col I para desbloquear)"

' Ejecuta esto para confirmar qué versión está instalada
Public Sub VersionImportador()
    MsgBox "Importador de Avalúos" & vbCrLf & VERSION_MACRO, vbInformation, "Versión"
End Sub

' =====================================================================
' ENTRADAS (una por hoja). Asigna estas macros a los botones.
' =====================================================================
Public Sub ImportarUrbano()
    ImportarTipo "URBANO", "Encargos Urbanos"
End Sub

Public Sub ImportarRural()
    ImportarTipo "RURAL", "Encargos Rurales"
End Sub


' =====================================================================
' NÚCLEO
' =====================================================================
Private Sub ImportarTipo(tipoEsperado As String, hoja As String)
    Dim ruta As String
    ruta = SeleccionarArchivo()
    If ruta = "" Then Exit Sub

    Dim contenido As String
    contenido = LeerArchivoUTF8(ruta)
    If contenido = "" Then
        MsgBox "No se pudo leer el archivo o está vacío.", vbExclamation
        Exit Sub
    End If

    Dim j As Object
    On Error Resume Next
    Set j = ParseJson(contenido)
    On Error GoTo 0
    If j Is Nothing Then
        MsgBox "El archivo no es un JSON válido.", vbCritical
        Exit Sub
    End If

    Dim tipo As String
    tipo = Nz(j("tipo"))
    If tipo <> tipoEsperado Then
        MsgBox "Este archivo es de tipo '" & tipo & "'." & vbCrLf & _
               "Esta hoja solo admite registros '" & tipoEsperado & "'." & vbCrLf & vbCrLf & _
               "Usa el botón de la hoja correspondiente.", vbExclamation
        Exit Sub
    End If

    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets(hoja)

    ' Mapa de encabezados (texto normalizado -> nº de columna)
    Dim cols As Object
    Set cols = MapaEncabezados(ws)

    ' Columna que usamos para detectar fila vacía: la de "Contratante (s)"
    Dim colRef As Long
    colRef = BuscarCol(cols, "Contratante (s)")
    If colRef = 0 Then colRef = BuscarCol(cols, "Contratante")
    If colRef = 0 Then colRef = 2

    Dim sugerida As Long
    sugerida = PrimeraFilaVacia(ws, colRef)

    Dim filaTxt As String
    filaTxt = InputBox("Importar registro " & tipo & " — " & Nz(j("contratante")) & vbCrLf & vbCrLf & _
                       "¿En qué fila? (sugerida, primera vacía: " & sugerida & ")", _
                       "Fila destino", CStr(sugerida))
    If filaTxt = "" Then Exit Sub
    Dim fila As Long
    fila = CLng(Val(filaTxt))
    If fila < 2 Then
        MsgBox "La fila debe ser 2 o mayor (la 1 es de encabezados).", vbExclamation
        Exit Sub
    End If

    Dim modoInsertar As Boolean
    If Trim(Nz(ws.Cells(fila, colRef).Value)) <> "" Then
        Dim resp As VbMsgBoxResult
        resp = MsgBox("La fila " & fila & " ya tiene datos." & vbCrLf & vbCrLf & _
                      "SÍ = Insertar fila nueva (empuja las de abajo)" & vbCrLf & _
                      "NO = Sobrescribir esa fila", vbYesNoCancel + vbQuestion, "Fila ocupada")
        If resp = vbCancel Then Exit Sub
        modoInsertar = (resp = vbYes)
    End If

    Application.ScreenUpdating = False
    Application.EnableEvents = False

    If modoInsertar Then ws.Rows(fila).Insert Shift:=xlDown

    ' 1) Limpiar la fila destino por completo (evita arrastrar basura)
    ws.Rows(fila).ClearContents

    ' 2) Heredar SOLO el formato de una fila modelo buena
    Dim filaModelo As Long
    filaModelo = ElegirFilaModelo(ws, fila, colRef)
    If filaModelo > 0 And filaModelo <> fila Then
        ws.Rows(filaModelo).Copy
        ws.Rows(fila).PasteSpecial Paste:=xlPasteFormats
        Application.CutCopyMode = False
    End If

    ' 3) Escribir los datos por nombre de encabezado
    If tipo = "URBANO" Then
        EscribirUrbano ws, fila, cols, j
    Else
        EscribirRural ws, fila, cols, j
    End If

    ' 4) Reponer SOLO las fórmulas legítimas, copiándolas de la fila modelo
    '    (con referencias ajustadas a la fila destino). Nunca se escriben
    '    como datos, así que el desplegable de Municipio queda intacto.
    If filaModelo > 0 And filaModelo <> fila Then
        PropagarFormulas ws, filaModelo, fila
    End If

    ' 5) Forzar recálculo para que las fórmulas (Provincia, etc.) se actualicen
    Application.CalculateFull

    Application.EnableEvents = True
    Application.ScreenUpdating = True

    MsgBox "Registro importado en la fila " & fila & " de '" & hoja & "'." & vbCrLf & _
           "Municipio: " & Nz(j("municipio")) & " — verifica que aparezca igual en la lista" & vbCrLf & _
           "para que las fórmulas automáticas calculen.", vbInformation
End Sub


' ---------- ESCRITURA POR NOMBRE DE ENCABEZADO ----------
Private Sub EscribirUrbano(ws As Worksheet, f As Long, cols As Object, j As Object)
    ' Desbloquear la fila: escribir "x" en la columna de validación (I).
    ' Esto satisface la regla $I="x" y deja la fila marcada como cargada.
    DesbloquearFila ws, f
    Set1 ws, cols, f, "Fecha de visita", FechaDe(j, "fecha_visita_texto")
    Set1 ws, cols, f, "Contratante (s)", Nz(j("contratante"))
    Set1 ws, cols, f, "Dirección", Nz(j("direccion"))
    Set1 ws, cols, f, "Municipio", Nz(j("municipio"))
    Set1 ws, cols, f, "Departamento", Nz(j("departamento"))
    Set1 ws, cols, f, "Fecha elaboración", FechaDe(j, "fecha_elaboracion")
    Set1 ws, cols, f, "Área Lote", NumDe(j, "area_lote")
    Set1 ws, cols, f, "Construida a", NumDe(j, "area_construida")
    Set1 ws, cols, f, "Finalidad avalúo", Nz(j("finalidad"))
    Set1 ws, cols, f, "Servicios publicos", Nz(j("servicios"))
    Set1 ws, cols, f, "Frente", NumDe(j, "frente")
    Set1 ws, cols, f, "Fondo", NumDe(j, "fondo")
    Set1 ws, cols, f, "Estrato", Nz(j("estrato"))
    Set1 ws, cols, f, "Techo", Nz(j("techo"))
    Set1 ws, cols, f, "Muro", Nz(j("muro"))
    Set1 ws, cols, f, "Piso", Nz(j("piso"))
    Set1 ws, cols, f, "Afectaciones a la propiedad", Nz(j("afectaciones"))
    Set1 ws, cols, f, "Titulo de adquisición", Nz(j("titulo_adquisicion"))
    Set1 ws, cols, f, "Matrícula inmobiliaria", Nz(j("matricula"))
    Set1 ws, cols, f, "Código catastral", Nz(j("codigo_catastral"))
    Set1 ws, cols, f, "Uso de suelos", Nz(j("uso_suelo"))
    Set1 ws, cols, f, "Estabilidad del suelo", Nz(j("estabilidad_suelo"))
    Set1 ws, cols, f, "Impacto ambiental", Nz(j("impacto_ambiental"))
    Set1 ws, cols, f, "Servidumbres y cesiones", Nz(j("servidumbres"))
    Set1 ws, cols, f, "Estado de conservación", Nz(j("estado_conservacion"))
    Set1 ws, cols, f, "Consideraciones especiales", Nz(j("consideraciones"))
    ' Propietario y Provincia/Código/etc. = fórmulas: NO se escriben
End Sub

Private Sub EscribirRural(ws As Worksheet, f As Long, cols As Object, j As Object)
    DesbloquearFila ws, f
    ' marca de tipo en columna A si existe y no tiene encabezado
    If Trim(Nz(ws.Cells(1, 1).Value)) = "" Then ws.Cells(f, 1).Value = "RURAL"
    Set1 ws, cols, f, "Fecha de visita", FechaDe(j, "fecha_visita_texto")
    Set1 ws, cols, f, "Contratante (s)", Nz(j("contratante"))
    Set1 ws, cols, f, "Dirección", Trim(Nz(j("vereda")) & IIf(Nz(j("descripcion_acceso")) <> "", " - " & Nz(j("descripcion_acceso")), ""))
    Set1 ws, cols, f, "Municipio", Nz(j("municipio"))
    Set1 ws, cols, f, "Departamento", Nz(j("departamento"))
    Set1 ws, cols, f, "Fecha elaboración", FechaDe(j, "fecha_entrega")
    Set1 ws, cols, f, "Área lote", NumDe(j, "area_lote")
    Set1 ws, cols, f, "Área construida", NumDe(j, "area_construida")
    Set1 ws, cols, f, "Finalidad avalúo", Nz(j("finalidad"))
    Set1 ws, cols, f, "Servicios publicos", Nz(j("servicios"))
    Set1 ws, cols, f, "Vias de acceso", Nz(j("vias_acceso"))
    Set1 ws, cols, f, "Topografía", Nz(j("topografia"))
    Set1 ws, cols, f, "Mecanización", Nz(j("mecanizacion"))
    Set1 ws, cols, f, "Uso actual del predio", Nz(j("cultivos_actuales"))
    Set1 ws, cols, f, "Hidrológia intermitente", Nz(j("cauce_intermitente"))
    Set1 ws, cols, f, "Hidrológia permanente", Nz(j("cauce_permanente"))
    Set1 ws, cols, f, "Disponibilidad Hidrológica", Nz(j("disponibilidad_agua"))
    Set1 ws, cols, f, "Cerramiento", Nz(j("cercado"))
    Set1 ws, cols, f, "Techo", Nz(j("techo"))
    Set1 ws, cols, f, "Muro", Nz(j("muro"))
    Set1 ws, cols, f, "Piso", Nz(j("piso"))
    Set1 ws, cols, f, "Afectaciones a la propiedad", Nz(j("afectaciones"))
    Set1 ws, cols, f, "Titulo de adquisición", Nz(j("titulo_adquisicion"))
    Set1 ws, cols, f, "Matrícula inmobiliaria", Nz(j("matricula"))
    Set1 ws, cols, f, "Código catastral", Nz(j("codigo_catastral"))
    Set1 ws, cols, f, "Uso de suelos", Nz(j("uso_suelo"))
    Set1 ws, cols, f, "Estabilidad del suelo", Nz(j("estabilidad_suelo"))
    Set1 ws, cols, f, "Impacto ambiental", Nz(j("impacto_ambiental"))
    Set1 ws, cols, f, "Servidumbres y cesiones", Nz(j("servidumbres"))
    Set1 ws, cols, f, "Estado de conservación", Nz(j("estado_conservacion"))
    Set1 ws, cols, f, "Consideraciones especiales", Nz(j("consideraciones"))
    ' Provincia, Clima, Propietario, Ubicación, etc. = fórmulas: NO se escriben
End Sub


' =====================================================================
' BOTONES (ejecutar CrearBotones una sola vez)
' =====================================================================
Public Sub CrearBotones()
    AgregarBoton "Encargos Urbanos", "ImportarUrbano", "📥 Importar avalúo URBANO"
    AgregarBoton "Encargos Rurales", "ImportarRural", "📥 Importar avalúo RURAL"
    MsgBox "Botones creados en 'Encargos Urbanos' y 'Encargos Rurales'." & vbCrLf & _
           "Si no los ves, están arriba a la izquierda; puedes arrastrarlos.", vbInformation
End Sub

Private Sub AgregarBoton(hoja As String, macro As String, texto As String)
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets(hoja)
    Dim shp As Object
    ' borrar botones previos para no duplicar
    For Each shp In ws.Buttons
        shp.Delete
    Next shp
    Dim b As Object
    Set b = ws.Buttons.Add(2, 2, 200, 26)
    b.OnAction = macro
    b.Caption = texto
    b.Font.Size = 10
End Sub


' =====================================================================
' UTILIDADES
' =====================================================================
' Construye dict: encabezado normalizado -> columna
Private Function MapaEncabezados(ws As Worksheet) As Object
    Dim d As Object
    Set d = CreateObject("Scripting.Dictionary")
    Dim c As Long, ult As Long
    ult = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column
    If ult < 1 Then ult = 1
    If ult > 200 Then ult = 200
    For c = 1 To ult
        Dim h As String
        h = NormHdr(Nz(ws.Cells(1, c).Value))
        If h <> "" Then
            If Not d.Exists(h) Then d(h) = c
        End If
    Next c
    Set MapaEncabezados = d
End Function

Private Function BuscarCol(cols As Object, encabezado As String) As Long
    Dim k As String
    k = NormHdr(encabezado)
    If cols.Exists(k) Then
        BuscarCol = cols(k)
    Else
        BuscarCol = 0
    End If
End Function

' Escribe "x" en la columna que activa la validación (regla $I="x"),
' para desbloquear la fila y marcarla como cargada.
Private Sub DesbloquearFila(ws As Worksheet, f As Long)
    On Error Resume Next
    Dim colVal As Long
    colVal = ColumnaValidacion(ws)
    If colVal = 0 Then colVal = 9   ' por defecto columna I
    ws.Cells(f, colVal).Value = "x"
    On Error GoTo 0
End Sub

' Detecta la columna usada en la regla de validación tipo $X="x".
' Lee la validación de la fila 2 (representativa) en las primeras columnas.
Private Function ColumnaValidacion(ws As Worksheet) As Long
    On Error Resume Next
    Dim c As Long, fml As String, letra As String, i As Long, ch As String
    ColumnaValidacion = 0
    For c = 1 To 60
        fml = ""
        fml = ws.Cells(2, c).Validation.Formula1
        If InStr(fml, "=""x""") > 0 Then
            i = InStr(fml, "$")
            If i > 0 Then
                letra = ""
                i = i + 1
                Do While i <= Len(fml)
                    ch = Mid(fml, i, 1)
                    If ch >= "A" And ch <= "Z" Then
                        letra = letra & ch
                        i = i + 1
                    Else
                        Exit Do
                    End If
                Loop
                If letra <> "" Then
                    ColumnaValidacion = ws.Columns(letra).Column
                    Exit Function
                End If
            End If
        End If
    Next c
    On Error GoTo 0
End Function
Private Sub Set1(ws As Worksheet, cols As Object, f As Long, encabezado As String, valor As Variant)
    Dim c As Long
    c = BuscarCol(cols, encabezado)
    If c = 0 Then Exit Sub
    On Error Resume Next
    If ws.Cells(f, c).HasFormula Then Exit Sub
    If Trim(CStr(valor)) = "" Then Exit Sub
    ' Escribir el valor. Si la celda tiene validación que interfiere,
    ' se quita la validación de esa celda y se reintenta.
    ws.Cells(f, c).Value = valor
    If Trim(CStr(ws.Cells(f, c).Value)) = "" And Trim(CStr(valor)) <> "" Then
        ws.Cells(f, c).Validation.Delete
        ws.Cells(f, c).Value = valor
    End If
    On Error GoTo 0
End Sub

' Normaliza encabezado: minúsculas, sin acentos, sin espacios extra
Private Function NormHdr(s As String) As String
    Dim t As String
    t = LCase(Trim(s))
    t = Replace(t, "á", "a"): t = Replace(t, "é", "e"): t = Replace(t, "í", "i")
    t = Replace(t, "ó", "o"): t = Replace(t, "ú", "u"): t = Replace(t, "ñ", "n")
    t = Replace(t, "ü", "u")
    ' colapsar espacios dobles
    Do While InStr(t, "  ") > 0
        t = Replace(t, "  ", " ")
    Loop
    NormHdr = t
End Function

Private Function SeleccionarArchivo() As String
    Dim fd As FileDialog
    Set fd = Application.FileDialog(msoFileDialogFilePicker)
    fd.Title = "Selecciona el registro _Db.json"
    fd.Filters.Clear
    fd.Filters.Add "JSON", "*.json"
    fd.AllowMultiSelect = False
    On Error Resume Next
    fd.InitialFileName = Environ("USERPROFILE") & "\OneDrive\001 TRABAJO\01 AVALÚOS\Automatización\"
    On Error GoTo 0
    If fd.Show = -1 Then SeleccionarArchivo = fd.SelectedItems(1) Else SeleccionarArchivo = ""
End Function

Private Function LeerArchivoUTF8(ruta As String) As String
    Dim stream As Object
    Set stream = CreateObject("ADODB.Stream")
    stream.Type = 2
    stream.Charset = "utf-8"
    stream.Open
    stream.LoadFromFile ruta
    LeerArchivoUTF8 = stream.ReadText(-1)
    stream.Close
End Function

Private Function PrimeraFilaVacia(ws As Worksheet, col As Long) As Long
    Dim r As Long
    r = 2
    Do While Trim(Nz(ws.Cells(r, col).Value)) <> ""
        r = r + 1
        If r > 100000 Then Exit Do
    Loop
    PrimeraFilaVacia = r
End Function

' Elige una fila modelo BUENA: con datos y SIN fórmulas-basura en
' columnas de datos (ej. Piso). Evita heredar fórmulas mal puestas.
Private Function ElegirFilaModelo(ws As Worksheet, filaDestino As Long, colRef As Long) As Long
    Dim cols As Object
    Set cols = MapaEncabezados(ws)
    Dim colPiso As Long
    colPiso = BuscarCol(cols, "Piso")

    Dim r As Long
    ' primero: filas con datos cuya columna Piso NO sea fórmula
    For r = 2 To 2000
        If r <> filaDestino Then
            If Trim(Nz(ws.Cells(r, colRef).Value)) <> "" Then
                Dim malo As Boolean
                malo = False
                If colPiso > 0 Then
                    If ws.Cells(r, colPiso).HasFormula Then malo = True
                End If
                If Not malo Then
                    ElegirFilaModelo = r
                    Exit Function
                End If
            End If
        End If
    Next r
    ' respaldo: cualquier fila con datos
    For r = 2 To 2000
        If r <> filaDestino And Trim(Nz(ws.Cells(r, colRef).Value)) <> "" Then
            ElegirFilaModelo = r
            Exit Function
        End If
    Next r
    ElegirFilaModelo = 0
End Function

' Copia SOLO las celdas con fórmula de filaModelo a filaDestino.
' Excel ajusta las referencias relativas automáticamente al copiar.
Private Sub PropagarFormulas(ws As Worksheet, filaModelo As Long, filaDestino As Long)
    Dim ult As Long, c As Long
    ult = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column
    If ult < 1 Or ult > 300 Then ult = 60
    For c = 1 To ult
        Dim celdaModelo As Range
        Set celdaModelo = ws.Cells(filaModelo, c)
        If celdaModelo.HasFormula Then
            ' copiar la celda con fórmula (ajusta referencias relativas)
            celdaModelo.Copy ws.Cells(filaDestino, c)
        End If
    Next c
    Application.CutCopyMode = False
End Sub

Private Function Nz(v As Variant) As String
    On Error Resume Next
    If IsNull(v) Or IsEmpty(v) Then Nz = "" Else Nz = CStr(v)
    On Error GoTo 0
End Function

Private Function NumDe(j As Object, clave As String) As Variant
    Dim s As String
    s = Nz(j(clave))
    If s = "" Then
        NumDe = ""
        Exit Function
    End If
    ' El JSON trae el número con punto decimal (ej. 6.1).
    ' Convertir a número real usando Val, que SIEMPRE interpreta el punto
    ' como separador decimal sin importar la configuración regional.
    ' Así Excel recibe un número de verdad (no texto) y respeta su propio
    ' separador al mostrarlo.
    Dim valido As Boolean
    valido = EsNumeroJson(s)
    If valido Then
        NumDe = Val(s)   ' Val usa punto decimal universalmente
    Else
        NumDe = s        ' no es número (texto), se deja igual
    End If
End Function

' ¿La cadena es un número con punto decimal? (no usa configuración local)
Private Function EsNumeroJson(s As String) As Boolean
    Dim i As Long, ch As String, puntos As Long
    If Len(s) = 0 Then EsNumeroJson = False: Exit Function
    For i = 1 To Len(s)
        ch = Mid(s, i, 1)
        If ch = "." Then
            puntos = puntos + 1
        ElseIf ch = "-" Then
            If i <> 1 Then EsNumeroJson = False: Exit Function
        ElseIf ch < "0" Or ch > "9" Then
            EsNumeroJson = False: Exit Function
        End If
    Next i
    EsNumeroJson = (puntos <= 1)
End Function

Private Function FechaDe(j As Object, clave As String) As Variant
    Dim s As String
    s = Nz(j(clave))
    If s = "" Then FechaDe = "": Exit Function
    Dim partes() As String
    If InStr(s, "-") > 0 Then
        partes = Split(s, "-")
        If UBound(partes) = 2 Then
            On Error Resume Next
            FechaDe = DateSerial(CInt(partes(0)), CInt(partes(1)), CInt(partes(2)))
            On Error GoTo 0
            Exit Function
        End If
    End If
    FechaDe = s
End Function


' =====================================================================
' PARSER JSON
' =====================================================================
Public Function ParseJson(texto As String) As Object
    js = texto
    p = 1
    SkipWs
    Set ParseJson = ParseValue
End Function

Private Function ParseValue() As Variant
    SkipWs
    Dim ch As String
    ch = Mid(js, p, 1)
    If ch = "{" Then
        Set ParseValue = ParseObject
    ElseIf ch = "[" Then
        Set ParseValue = ParseArray
    ElseIf ch = """" Then
        ParseValue = ParseString
    ElseIf ch = "t" Or ch = "f" Then
        ParseValue = ParseBool
    ElseIf ch = "n" Then
        p = p + 4: ParseValue = Null
    Else
        ParseValue = ParseNumber
    End If
End Function

Private Function ParseObject() As Object
    Dim d As Object
    Set d = CreateObject("Scripting.Dictionary")
    p = p + 1
    SkipWs
    If Mid(js, p, 1) = "}" Then p = p + 1: Set ParseObject = d: Exit Function
    Do
        SkipWs
        Dim clave As String
        clave = ParseString
        SkipWs
        p = p + 1
        If EsContenedor() Then
            Dim o As Object
            Set o = ParseValue
            d(clave) = Empty
            Set d(clave) = o
        Else
            d(clave) = ParseValue
        End If
        SkipWs
        Dim ch As String
        ch = Mid(js, p, 1)
        p = p + 1
        If ch = "}" Then Exit Do
    Loop
    Set ParseObject = d
End Function

Private Function ParseArray() As Object
    Dim col As Object
    Set col = CreateObject("Scripting.Dictionary")
    Dim idx As Long
    idx = 0
    p = p + 1
    SkipWs
    If Mid(js, p, 1) = "]" Then p = p + 1: Set ParseArray = col: Exit Function
    Do
        If EsContenedor() Then
            Dim o As Object
            Set o = ParseValue
            col(idx) = Empty
            Set col(idx) = o
        Else
            col(idx) = ParseValue
        End If
        idx = idx + 1
        SkipWs
        Dim ch As String
        ch = Mid(js, p, 1)
        p = p + 1
        If ch = "]" Then Exit Do
    Loop
    Set ParseArray = col
End Function

Private Function EsContenedor() As Boolean
    Dim g As Long
    g = p
    SkipWs
    Dim ch As String
    ch = Mid(js, p, 1)
    p = g
    EsContenedor = (ch = "{" Or ch = "[")
End Function

Private Function ParseString() As String
    Dim res As String
    p = p + 1
    Do While p <= Len(js)
        Dim ch As String
        ch = Mid(js, p, 1)
        If ch = """" Then
            p = p + 1
            Exit Do
        ElseIf ch = "\" Then
            p = p + 1
            Dim esc As String
            esc = Mid(js, p, 1)
            Select Case esc
                Case "n": res = res & vbLf
                Case "t": res = res & vbTab
                Case "r": res = res & vbCr
                Case "u"
                    res = res & ChrW(CLng("&H" & Mid(js, p + 1, 4)))
                    p = p + 4
                Case Else: res = res & esc
            End Select
            p = p + 1
        Else
            res = res & ch
            p = p + 1
        End If
    Loop
    ParseString = res
End Function

Private Function ParseNumber() As Variant
    Dim res As String
    Do While p <= Len(js)
        Dim ch As String
        ch = Mid(js, p, 1)
        If InStr("0123456789+-.eE", ch) > 0 Then
            res = res & ch
            p = p + 1
        Else
            Exit Do
        End If
    Loop
    ' Guardar SIEMPRE como texto. La conversión a número se hace luego con
    ' Val() (que usa punto decimal universal). Usar CDbl aquí rompería los
    ' decimales en Excel con configuración de coma (6.1 -> 61).
    ParseNumber = res
End Function

Private Function ParseBool() As Boolean
    If Mid(js, p, 1) = "t" Then p = p + 4: ParseBool = True Else p = p + 5: ParseBool = False
End Function

Private Sub SkipWs()
    Do While p <= Len(js)
        Dim ch As String
        ch = Mid(js, p, 1)
        If ch = " " Or ch = vbTab Or ch = vbCr Or ch = vbLf Then
            p = p + 1
        Else
            Exit Do
        End If
    Loop
End Sub
