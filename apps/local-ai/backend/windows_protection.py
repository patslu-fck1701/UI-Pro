"""Windows-user-bound DPAPI encryption for local operator backups."""
import ctypes
import os
from ctypes import wintypes

MAGIC=b'WERKZ-DPAPI-1\n'

class Blob(ctypes.Structure):
    _fields_=[('size',wintypes.DWORD),('data',ctypes.POINTER(ctypes.c_ubyte))]

def _transform(data:bytes,encrypt:bool)->bytes:
    if os.name!='nt':raise RuntimeError('Diese Sicherung benötigt den ursprünglichen Windows-Benutzer und Windows-DPAPI.')
    source_buffer=ctypes.create_string_buffer(data)
    source=Blob(len(data),ctypes.cast(source_buffer,ctypes.POINTER(ctypes.c_ubyte)))
    result=Blob();crypt=ctypes.WinDLL('crypt32',use_last_error=True);kernel=ctypes.WinDLL('kernel32',use_last_error=True)
    kernel.LocalFree.argtypes=[ctypes.c_void_p];kernel.LocalFree.restype=ctypes.c_void_p
    if encrypt:
        function=crypt.CryptProtectData
        function.argtypes=[ctypes.POINTER(Blob),wintypes.LPCWSTR,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,wintypes.DWORD,ctypes.POINTER(Blob)]
        ok=function(ctypes.byref(source),'WERKZ local backup',None,None,None,1,ctypes.byref(result))
    else:
        function=crypt.CryptUnprotectData
        function.argtypes=[ctypes.POINTER(Blob),ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,wintypes.DWORD,ctypes.POINTER(Blob)]
        ok=function(ctypes.byref(source),None,None,None,None,1,ctypes.byref(result))
    if not ok:raise RuntimeError('Windows konnte die Sicherung nicht schützen beziehungsweise mit diesem Benutzer entschlüsseln.')
    try:return ctypes.string_at(result.data,result.size)
    finally:kernel.LocalFree(ctypes.cast(result.data,ctypes.c_void_p))

def protect(data:bytes)->bytes:return MAGIC+_transform(data,True)

def unprotect(data:bytes)->bytes:
    if not data.startswith(MAGIC):raise ValueError('Keine geschützte WERKZ-Sicherung. Unverschlüsselte Altarchive gesondert prüfen.')
    return _transform(data[len(MAGIC):],False)
